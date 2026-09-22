/**
 * Building the highlight layer for a very large number of matches.
 *
 * Spreading every match into `new Highlight(...)` hits the engine's cap on the
 * argument list somewhere between 50 000 and 100 000, and the throw left the
 * search without highlights and with a stale counter.
 */
import { describe, expect, it } from 'vitest';
import { buildHighlight } from '../src/highlighter.ts';

/** Stands in for the browser's Highlight: set-like, and it keeps what it was given. */
class FakeHighlight {
	readonly ranges: unknown[];
	constructor(...ranges: unknown[]) {
		this.ranges = ranges;
	}
	add(range: unknown): this {
		this.ranges.push(range);
		return this;
	}
}

const HighlightCtor = FakeHighlight as unknown as Parameters<typeof buildHighlight>[0];
const fakeRanges = (n: number) => Array.from({ length: n }, (_, i) => ({ i }) as unknown as Range);

describe('buildHighlight', () => {
	it('holds every range it was given, in order', () => {
		const built = buildHighlight(HighlightCtor, fakeRanges(3)) as FakeHighlight;
		expect(built.ranges).toEqual([{ i: 0 }, { i: 1 }, { i: 2 }]);
	});

	it('copes with far more matches than an argument list can carry', () => {
		const many = fakeRanges(200_000);
		// The old way, kept here as the control: this is what used to throw.
		expect(() => new FakeHighlight(...many)).toThrow(RangeError);

		const built = buildHighlight(HighlightCtor, many) as FakeHighlight;
		expect(built.ranges).toHaveLength(200_000);
	});
});
