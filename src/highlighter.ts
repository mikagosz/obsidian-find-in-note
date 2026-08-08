/**
 * Finding matches in the reading view and painting them.
 *
 * The reason this plugin exists at all: highlights must not touch the DOM.
 * Wrapping a match in a <span> fights Obsidian's own renderer, and the built-in
 * editor search has to expose the raw Markdown of whatever block holds the
 * match — which is what turns a rendered table back into a wall of pipes.
 *
 * The CSS Custom Highlight API paints ranges without changing a single node,
 * so the note keeps looking exactly like it did before the search started.
 */

const MATCH_LAYER = 'find-in-note-match';
const CURRENT_LAYER = 'find-in-note-current';

/**
 * Minimal shape of the CSS Custom Highlight API. Declared locally rather than
 * relying on the TypeScript DOM lib, which only grew these types recently —
 * this keeps the plugin compiling on whatever lib version is installed.
 */
type HighlightConstructor = new (...ranges: Range[]) => unknown;

interface HighlightRegistry {
	set(name: string, highlight: unknown): void;
	delete(name: string): void;
}

function registry(): HighlightRegistry | undefined {
	return (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
}

function highlightConstructor(): HighlightConstructor | undefined {
	return (window as unknown as { Highlight?: HighlightConstructor }).Highlight;
}

/** False on a runtime too old for the Highlight API, so the caller can say so. */
export function isSupported(): boolean {
	return registry() !== undefined && highlightConstructor() !== undefined;
}

interface TextChunk {
	node: Text;
	/** Offset of this node's first character within the flattened note text. */
	start: number;
}

/**
 * Flatten every text node under `root` into one string, remembering where each
 * node landed. Searching the flattened text is what lets a match span element
 * boundaries — "zbiór asercji" is two text nodes when part of it is bold.
 */
function flatten(root: HTMLElement): { text: string; chunks: TextChunk[] } {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			const parent = node.parentElement;
			if (!parent) return NodeFilter.FILTER_REJECT;
			// Never search our own search bar.
			if (parent.closest('.find-in-note-bar')) {
				return NodeFilter.FILTER_REJECT;
			}
			if (node.nodeValue === null || node.nodeValue.length === 0) {
				return NodeFilter.FILTER_REJECT;
			}
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	const chunks: TextChunk[] = [];
	const parts: string[] = [];
	let offset = 0;

	for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
		const text = node as Text;
		chunks.push({ node: text, start: offset });
		parts.push(text.data);
		offset += text.data.length;
	}

	return { text: parts.join(''), chunks };
}

function escapeForRegExp(query: string): string {
	return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every `[start, end)` span of `query` in `text`, case-insensitive and literal.
 *
 * Split out from the DOM walk so the offset arithmetic — the part that would
 * silently mis-highlight if it drifted — can be checked without a browser.
 * Matching runs against the original string, never a lower-cased copy: some
 * characters change length when cased, which would shift every later offset.
 */
export function matchSpans(text: string, query: string): [number, number][] {
	if (query.length === 0) return [];

	const pattern = new RegExp(escapeForRegExp(query), 'gi');
	const spans: [number, number][] = [];

	for (const match of text.matchAll(pattern)) {
		if (match.index === undefined) continue;
		spans.push([match.index, match.index + match[0].length]);
	}

	return spans;
}

/** Index of the chunk holding `offset`, searching forward from `from`. */
function chunkAt(chunks: TextChunk[], from: number, offset: number): number {
	let i = from;
	while (i < chunks.length) {
		const chunk = chunks[i];
		if (chunk === undefined) return -1;
		if (offset < chunk.start + chunk.node.data.length) return i;
		i++;
	}
	return -1;
}

/**
 * Every match of `query`, as ranges over the live DOM.
 *
 * Matching is case-insensitive and literal — the query is escaped, so a user
 * typing `C++` or `*` searches for that text rather than a broken pattern.
 */
export function findRanges(root: HTMLElement, query: string): Range[] {
	if (query.length === 0) return [];
	if (!isSupported()) return [];

	const { text, chunks } = flatten(root);
	if (chunks.length === 0) return [];

	const ranges: Range[] = [];
	// Matches arrive in ascending order, so the chunk cursor only moves forward
	// and the whole pass stays linear instead of rescanning from the top.
	let cursor = 0;

	for (const [start, end] of matchSpans(text, query)) {
		const startIndex = chunkAt(chunks, cursor, start);
		if (startIndex === -1) break;
		const endIndex = chunkAt(chunks, startIndex, end - 1);
		if (endIndex === -1) break;
		cursor = startIndex;

		const startChunk = chunks[startIndex];
		const endChunk = chunks[endIndex];
		if (startChunk === undefined || endChunk === undefined) break;

		const range = document.createRange();
		range.setStart(startChunk.node, start - startChunk.start);
		range.setEnd(endChunk.node, end - endChunk.start);
		ranges.push(range);
	}

	return ranges;
}

/**
 * Paint the matches. Both layers are cleared first so that the current match is
 * always registered last: the Highlight API stacks layers in insertion order,
 * and the current one has to sit on top of the plain ones.
 */
export function paint(all: Range[], current: Range | undefined): void {
	const reg = registry();
	const Highlight = highlightConstructor();
	if (!reg || !Highlight) return;

	reg.delete(MATCH_LAYER);
	reg.delete(CURRENT_LAYER);
	if (all.length === 0) return;

	reg.set(MATCH_LAYER, new Highlight(...all));
	if (current) reg.set(CURRENT_LAYER, new Highlight(current));
}

export function clear(): void {
	const reg = registry();
	if (!reg) return;
	reg.delete(MATCH_LAYER);
	reg.delete(CURRENT_LAYER);
}

/**
 * Bring a match into view, but only when it is actually off screen — scrolling
 * on every keystroke is the twitchiness this plugin is meant to remove.
 */
export function revealIfOffScreen(range: Range, scroller: HTMLElement): void {
	const rect = range.getBoundingClientRect();
	// A range inside a collapsed or not-yet-laid-out block has no box to aim at.
	if (rect.width === 0 && rect.height === 0) return;

	const view = scroller.getBoundingClientRect();
	const margin = 48;
	const above = rect.top < view.top + margin;
	const below = rect.bottom > view.bottom - margin;
	if (!above && !below) return;

	scroller.scrollTop += rect.top - view.top - view.height / 2 + rect.height / 2;
}
