import {
	type Debouncer,
	debounce,
	type KeymapEventHandler,
	MarkdownView,
	Notice,
	Platform,
	Plugin,
	type ViewState,
} from 'obsidian';
import { clear, findRanges, isSupported, paint, revealIfOffScreen } from './highlighter';
import { SearchBar } from './searchBar';

/** Marks the element the bar is positioned against. */
const HOST_CLASS = 'find-in-note-host';

/**
 * Said once, on first load. Obsidian's built-in search holds Cmd+F and a plugin
 * cannot take it away — two attempts at doing so from code were measured and
 * failed. Rewriting the user's hotkeys.json behind their back would work and is
 * exactly the kind of thing a plugin has no business doing, so the honest move
 * is to say plainly what has to be clicked.
 */
const HOTKEY_NOTICE =
	"Find in Note is ready, but Cmd/Ctrl+F still belongs to Obsidian's built-in search — a plugin cannot take that shortcut on its own.\n\n" +
	'To hand it over: Settings → Hotkeys, click the keyboard icon next to the filter box, press Cmd/Ctrl+F, and remove the binding from the built-in search. Find in Note already claims that shortcut and takes over.\n\n' +
	'Until then, run it from the command palette: "Find in note".';

interface PluginData {
	hotkeyNoticeShown?: boolean;
}

interface Session {
	view: MarkdownView;
	bar: SearchBar;
	host: HTMLElement;
	/** Restored verbatim on close, so an edit session comes back as it was. */
	previousState: ViewState;
	restoreState: boolean;
	observer: MutationObserver;
	rescan: Debouncer<[], void>;
	escape: KeymapEventHandler;
	ranges: Range[];
	index: number;
}

export default class FindInNotePlugin extends Plugin {
	private session: Session | null = null;

	override onload() {
		this.addCommand({
			id: 'open',
			// Obsidian shows this after the plugin name, so repeating it here
			// would read "Find in Note: Find in note".
			name: 'Search the open note',
			// Declared as the default so the command arrives pre-bound in
			// Settings → Hotkeys. Obsidian's own Cmd+F still wins until its
			// binding is cleared there — see the README. Two attempts at
			// stealing the key from underneath (a capture-phase DOM listener,
			// then a keymap registration) both lost, and the settings screen is
			// the mechanism Obsidian actually provides for this.
			hotkeys: [{ modifiers: ['Mod'], key: 'F' }],
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				if (!checking) void this.open(view);
				return true;
			},
		});

		void this.announceHotkeyConflict();

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				if (!this.session) return;
				const active = this.app.workspace.getActiveViewOfType(MarkdownView);
				// Switching the view mode counts as a leaf change, so only a
				// move to a genuinely different note may close the session.
				if (active === this.session.view) return;
				this.close();
			}),
		);
	}

	override onunload() {
		this.close();
	}

	private async announceHotkeyConflict(): Promise<void> {
		// There is no keyboard shortcut to fight over on a phone, so the notice
		// would be a wall of irrelevant text in front of a small screen.
		if (Platform.isMobile) return;

		const data = ((await this.loadData()) ?? {}) as PluginData;
		if (data.hotkeyNoticeShown) return;

		// Duration 0 keeps it up until dismissed. This is the one thing the user
		// has to do by hand, and a notice that fades after five seconds is a
		// notice nobody read.
		new Notice(HOTKEY_NOTICE, 0);
		await this.saveData({ ...data, hotkeyNoticeShown: true });
	}

	private async open(view: MarkdownView): Promise<void> {
		if (this.session?.view === view) {
			this.session.bar.focus();
			return;
		}
		this.close();

		if (!isSupported()) {
			new Notice(
				'This Obsidian build cannot paint highlights, so searching in place is unavailable.',
			);
			return;
		}

		const previousState = cloneState(view.leaf.getViewState());
		const restoreState = previousState.state?.mode !== 'preview';
		if (restoreState) {
			await view.leaf.setViewState({
				...previousState,
				state: { ...previousState.state, mode: 'preview' },
			});
		}

		const host = view.contentEl;
		host.addClass(HOST_CLASS);

		const bar = new SearchBar(host, {
			onQuery: (query) => this.search(query, true),
			onStep: (delta) => this.step(delta),
			onClose: () => this.close(),
		});

		const rescan = debounce(
			() => {
				if (this.session) this.search(this.session.bar.query, false);
			},
			150,
			true,
		);
		// Reading view renders long notes in pieces as they scroll into sight,
		// so matches further down appear later. Re-running on every render keeps
		// the highlights and the counter honest as more of the note arrives.
		const observer = new MutationObserver(() => rescan());
		observer.observe(view.previewMode.containerEl, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		// Only while the bar is open, so Escape keeps its usual meaning the rest
		// of the time.
		const escapeHandler = this.app.scope.register([], 'Escape', () => {
			this.close();
			return false;
		});

		this.session = {
			view,
			bar,
			host,
			previousState,
			restoreState,
			observer,
			rescan,
			escape: escapeHandler,
			ranges: [],
			index: 0,
		};
		bar.focus();
	}

	/** Re-find and repaint. `reveal` is false for renders the user did not ask for. */
	private search(query: string, reveal: boolean): void {
		const session = this.session;
		if (!session) return;

		const root = session.view.previewMode.containerEl;
		session.ranges = findRanges(root, query);
		if (session.index >= session.ranges.length) session.index = 0;

		this.repaint(reveal);
	}

	private step(delta: number): void {
		const session = this.session;
		if (!session || session.ranges.length === 0) return;

		const total = session.ranges.length;
		session.index = (session.index + delta + total) % total;
		this.repaint(true);
	}

	private repaint(reveal: boolean): void {
		const session = this.session;
		if (!session) return;

		const current = session.ranges[session.index];
		paint(session.ranges, current);
		session.bar.setCount(session.index, session.ranges.length);

		if (reveal && current) {
			revealIfOffScreen(current, scrollerFor(session.view));
		}
	}

	private close(): void {
		const session = this.session;
		if (!session) return;
		this.session = null;

		this.app.scope.unregister(session.escape);
		session.rescan.cancel();
		session.observer.disconnect();
		session.bar.destroy();
		session.host.removeClass(HOST_CLASS);
		clear();

		if (session.restoreState) {
			void session.view.leaf.setViewState(session.previousState);
		}
	}
}

function cloneState(state: ViewState): ViewState {
	return { ...state, state: { ...state.state } };
}

/** The element that actually scrolls; the container around it does not. */
function scrollerFor(view: MarkdownView): HTMLElement {
	const scroller = view.previewMode.containerEl.querySelector('.markdown-preview-view');
	return scroller instanceof HTMLElement ? scroller : view.previewMode.containerEl;
}
