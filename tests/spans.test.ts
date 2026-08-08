/**
 * The one runnable check: offset arithmetic behind the highlights.
 *
 * If a span drifts by one character the highlight lands on the wrong letters,
 * and nothing on screen would say so — which is why this is the piece worth
 * pinning down.
 *
 * Ran on bare `node` until 2026-08-08, which tied it to Node >= 22.6 for type
 * stripping and broke CI on Node 20. Vitest compiles the TypeScript itself, so
 * the version constraint is gone.
 */
import { describe, expect, it } from 'vitest';
import { matchSpans } from '../src/highlighter.ts';

/** Substrings the spans actually point at — the thing the user ends up seeing. */
function sliced(text: string, query: string): string[] {
	return matchSpans(text, query).map(([start, end]) => text.slice(start, end));
}

describe('matchSpans', () => {
	it('keeps the exact position of a match inside a sentence', () => {
		expect(matchSpans('jedna asercja tutaj', 'asercja')).toEqual([[6, 13]]);
	});

	it('ignores case but points at the original casing', () => {
		expect(sliced('Asercja i asercja', 'asercja')).toEqual(['Asercja', 'asercja']);
	});

	it('returns several matches in ascending order, which the DOM walk relies on', () => {
		expect(matchSpans('aaa', 'a')).toEqual([
			[0, 1],
			[1, 2],
			[2, 3],
		]);
	});

	it('treats Polish diacritics as single characters, so later offsets stay right', () => {
		expect(sliced('źródło i źródło', 'źródło')).toEqual(['źródło', 'źródło']);
		expect(matchSpans('źródło i źródło', 'źródło')[1]).toEqual([9, 15]);
	});

	it('takes the query literally, not as a pattern', () => {
		// Handed to RegExp raw, these would explode or over-match.
		expect(matchSpans('a+b and C++', 'C++')).toEqual([[8, 11]]);
		expect(matchSpans('a.c and abc', 'a.c')).toEqual([[0, 3]]);
		expect(matchSpans('literal (parens)', '(parens)')).toEqual([[8, 16]]);
	});

	it('highlights nothing for an empty query, rather than everything', () => {
		expect(matchSpans('cokolwiek', '')).toEqual([]);
	});

	it('comes back empty for a word that is genuinely absent', () => {
		// Control sample. Without it, a matcher that silently stopped matching
		// anything would still look green.
		expect(matchSpans('jedna asercja tutaj', 'inwariant')).toEqual([]);
		// And its mirror: the same text does contain this one, so the check
		// above proves absence rather than proving the matcher is dead.
		expect(matchSpans('jedna asercja tutaj', 'tutaj')).toHaveLength(1);
	});
});
