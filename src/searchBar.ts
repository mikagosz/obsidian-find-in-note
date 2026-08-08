import { debounce, setIcon } from 'obsidian';

export interface SearchBarHandlers {
	/** Fired as the user types, already debounced. */
	onQuery: (query: string) => void;
	/** +1 for the next match, -1 for the previous one. */
	onStep: (delta: number) => void;
	onClose: () => void;
}

/**
 * The floating bar above the note. Deliberately not a modal: a modal steals the
 * page and hides the very text the user is trying to look at.
 */
export class SearchBar {
	readonly el: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly counter: HTMLElement;

	constructor(parent: HTMLElement, handlers: SearchBarHandlers) {
		this.el = parent.createDiv({
			cls: 'find-in-note-bar',
			attr: { role: 'search' },
		});

		this.input = this.el.createEl('input', {
			cls: 'find-in-note-input',
			attr: {
				type: 'text',
				placeholder: 'Find in note',
				// A placeholder is not a label: it disappears the moment typing
				// starts, and a screen reader would then announce nothing.
				'aria-label': 'Find in note',
				spellcheck: 'false',
				// Phones otherwise capitalise the first letter and quietly
				// "correct" the query into a different word.
				autocapitalize: 'off',
				autocorrect: 'off',
				enterkeyhint: 'search',
			},
		});

		this.counter = this.el.createSpan({
			cls: 'find-in-note-counter',
			// Announced as it changes, so the match count is not information
			// available only to people who can see it.
			attr: { role: 'status', 'aria-live': 'polite' },
		});
		this.setCount(0, 0);

		this.addButton('chevron-up', 'Previous match', () => handlers.onStep(-1));
		this.addButton('chevron-down', 'Next match', () => handlers.onStep(1));
		this.addButton('x', 'Close', handlers.onClose);

		// Typing repaints the whole note, so let the user finish a keystroke
		// burst first. 120 ms is short enough to still feel live.
		const notify = debounce(() => handlers.onQuery(this.input.value), 120, true);
		this.input.addEventListener('input', () => notify());

		this.input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				handlers.onStep(event.shiftKey ? -1 : 1);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				handlers.onClose();
			}
		});
	}

	private addButton(icon: string, label: string, onClick: () => void): void {
		const button = this.el.createEl('button', {
			cls: 'find-in-note-button clickable-icon',
			attr: { 'aria-label': label, type: 'button' },
		});
		setIcon(button, icon);
		button.addEventListener('click', (event) => {
			// Without this the note steals focus back and Enter stops working.
			event.preventDefault();
			onClick();
			this.input.focus();
		});
	}

	/** Focus and select, so a second Cmd+F replaces the previous query. */
	focus(): void {
		this.input.focus();
		this.input.select();
	}

	get query(): string {
		return this.input.value;
	}

	setCount(current: number, total: number): void {
		this.counter.setText(total === 0 ? '0/0' : `${current + 1}/${total}`);
		// "3/17" read aloud is "three seventeen"; spell it out for the announcer.
		this.counter.setAttr(
			'aria-label',
			total === 0 ? 'No matches' : `Match ${current + 1} of ${total}`,
		);
		this.el.toggleClass('find-in-note-empty', total === 0);
	}

	/** Shown when the runtime has no Highlight API to paint with. */
	setMessage(message: string): void {
		this.counter.setText(message);
	}

	destroy(): void {
		this.el.remove();
	}
}
