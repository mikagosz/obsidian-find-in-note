/**
 * One opening of the search at a time.
 *
 * Two quick presses of Cmd+F on a note in edit mode used to build two sessions,
 * and the first one was left behind with its Escape handler registered on the
 * app for good — past even disabling the plugin.
 */
import { describe, expect, it } from 'vitest';
import { SingleFlight } from '../src/singleFlight.ts';

/** A task that stays running until `finish` is called — the slow view switch. */
function pending(): { task: () => Promise<void>; finish: () => void; calls: () => number } {
	let calls = 0;
	let release: () => void = () => {};
	return {
		task: () => {
			calls++;
			return new Promise<void>((resolve) => {
				release = resolve;
			});
		},
		finish: () => release(),
		calls: () => calls,
	};
}

describe('SingleFlight', () => {
	it('refuses a second call while the first is still running', async () => {
		const gate = new SingleFlight();
		const slow = pending();

		const first = gate.run(slow.task);
		const second = await gate.run(slow.task);

		expect(second).toBe(false);
		expect(slow.calls()).toBe(1);

		slow.finish();
		expect(await first).toBe(true);
	});

	it('runs again once the first has finished', async () => {
		const gate = new SingleFlight();
		expect(await gate.run(async () => {})).toBe(true);
		expect(await gate.run(async () => {})).toBe(true);
	});

	it('is released when the task fails, and passes the failure on', async () => {
		const gate = new SingleFlight();
		await expect(
			gate.run(async () => {
				throw new Error('view switch rejected');
			}),
		).rejects.toThrow('view switch rejected');
		expect(await gate.run(async () => {})).toBe(true);
	});
});
