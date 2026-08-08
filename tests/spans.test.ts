/**
 * The one runnable check: offset arithmetic behind the highlights.
 *
 * Run with `npm run check`. No framework and no fixtures — Node strips the
 * types and runs this file directly. If a span drifts by one character the
 * highlight lands on the wrong letters, and nothing on screen would say so,
 * which is why this is the piece worth pinning down.
 */
import assert from 'node:assert/strict';
import { matchSpans } from '../src/highlighter.ts';

/** Substrings the spans actually point at — the thing the user ends up seeing. */
function sliced(text: string, query: string): string[] {
	return matchSpans(text, query).map(([start, end]) => text.slice(start, end));
}

// A match in the middle of a sentence keeps its exact position.
assert.deepEqual(matchSpans('jedna asercja tutaj', 'asercja'), [[6, 13]]);

// Case is ignored, but the span still points at the original casing.
assert.deepEqual(sliced('Asercja i asercja', 'asercja'), [
	'Asercja',
	'asercja',
]);

// Several matches come back in ascending order; the DOM walk relies on that.
const many = matchSpans('aaa', 'a');
assert.deepEqual(many, [
	[0, 1],
	[1, 2],
	[2, 3],
]);

// Polish diacritics are single characters, so offsets past them stay right.
assert.deepEqual(sliced('źródło i źródło', 'źródło'), ['źródło', 'źródło']);
assert.deepEqual(matchSpans('źródło i źródło', 'źródło')[1], [9, 15]);

// The query is literal, not a pattern: these would explode or over-match
// if it were handed to RegExp raw.
assert.deepEqual(matchSpans('a+b and C++', 'C++'), [[8, 11]]);
assert.deepEqual(matchSpans('a.c and abc', 'a.c'), [[0, 3]]);
assert.deepEqual(matchSpans('literal (parens)', '(parens)'), [[8, 16]]);

// An empty query highlights nothing rather than everything.
assert.deepEqual(matchSpans('cokolwiek', ''), []);

// Control sample: a word that is genuinely absent must come back empty. Without
// it a check that silently stopped matching anything would still look green.
assert.deepEqual(matchSpans('jedna asercja tutaj', 'inwariant'), []);
// And its mirror: the same text does contain this one, so the check above
// proves absence rather than proving the matcher is dead.
assert.equal(matchSpans('jedna asercja tutaj', 'tutaj').length, 1);

console.log('spans: OK');
