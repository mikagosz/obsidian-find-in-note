/**
 * The second half of the search: placing a flat match onto the text nodes.
 *
 * `spans.test.ts` covers finding the match in the flattened text. This covers
 * putting it back — the step that has to be right for a highlight to land on the
 * letters the user searched for, and whose failure is invisible: nothing errors,
 * the wrong words simply light up.
 *
 * Kept DOM-free on purpose. Bringing in jsdom for three assertions would put
 * dozens of packages behind a plugin that ships none.
 */

import { describe, expect, it } from 'vitest';
import { type ChunkSpan, matchSpans, rangeSpecs } from '../src/highlighter.ts';

/** Builds the chunk geometry the DOM walk would produce for these node texts. */
function chunksOf(...texts: string[]): { chunks: ChunkSpan[]; text: string } {
	let start = 0;
	const chunks = texts.map((t) => {
		const chunk = { start, length: t.length };
		start += t.length;
		return chunk;
	});
	return { chunks, text: texts.join('') };
}

/** What the highlight would actually cover, read back out of the node texts. */
function highlighted(texts: string[], query: string): string[] {
	const { chunks, text } = chunksOf(...texts);
	return rangeSpecs(chunks, matchSpans(text, query)).map((spec) => {
		if (spec.startIndex === spec.endIndex) {
			return texts[spec.startIndex]?.slice(spec.startOffset, spec.endOffset) ?? '';
		}
		const head = texts[spec.startIndex]?.slice(spec.startOffset) ?? '';
		const middle = texts.slice(spec.startIndex + 1, spec.endIndex).join('');
		const tail = texts[spec.endIndex]?.slice(0, spec.endOffset) ?? '';
		return head + middle + tail;
	});
}

describe('rangeSpecs', () => {
	it('places a match that sits inside one node', () => {
		const { chunks } = chunksOf('jedna asercja tutaj');
		expect(rangeSpecs(chunks, [[6, 13]])).toEqual([
			{ startIndex: 0, startOffset: 6, endIndex: 0, endOffset: 13 },
		]);
	});

	// The case the whole plugin exists for: part of the phrase is bold, so the
	// renderer split it across elements and the match has to span both.
	it('spans two nodes when an element boundary cuts the match in half', () => {
		expect(highlighted(['zbiór ', 'asercji', ' w teście'], 'zbiór asercji')).toEqual([
			'zbiór asercji',
		]);
	});

	it('spans three nodes, covering the whole middle one', () => {
		expect(highlighted(['ab', 'cd', 'ef'], 'bcde')).toEqual(['bcde']);
	});

	it('ends exactly at a node boundary without reaching into the next node', () => {
		const { chunks } = chunksOf('abc', 'def');
		// `abc` is [0,3): the last character is at index 2, so this must stay in chunk 0.
		expect(rangeSpecs(chunks, [[0, 3]])).toEqual([
			{ startIndex: 0, startOffset: 0, endIndex: 0, endOffset: 3 },
		]);
	});

	it('starts exactly at a node boundary', () => {
		expect(highlighted(['abc', 'def'], 'def')).toEqual(['def']);
	});

	it('keeps several matches in order, including one after a boundary', () => {
		expect(highlighted(['aXa', 'Xa'], 'a')).toEqual(['a', 'a', 'a']);
	});

	it('has nothing to place when nothing matched', () => {
		const { chunks } = chunksOf('abc');
		expect(rangeSpecs(chunks, [])).toEqual([]);
	});

	// Empty text nodes are filtered out by the DOM walk, but a chunk list that
	// cannot hold the span must stop rather than point at a node that is not there.
	it('stops instead of running past the end of the text', () => {
		const { chunks } = chunksOf('abc');
		expect(rangeSpecs(chunks, [[1, 99]])).toEqual([]);
	});
});
