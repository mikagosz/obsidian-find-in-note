/**
 * Lets one async task run at a time; a call made while one is still running is
 * refused rather than queued.
 *
 * Opening the search awaits the switch to reading view, and the session only
 * exists once that has finished. A second Cmd+F inside that window found no
 * session, so it built a second one — and the first was left behind with its bar
 * on screen, its observer running and its Escape handler registered on the app
 * for good, past even disabling the plugin. Refusing the second call is right:
 * the first one ends by focusing the bar, which is all a second press asks for.
 *
 * Kept free of Obsidian so the rule can be tested on its own.
 */
export class SingleFlight {
	private busy = false;

	/** Runs `task` unless one is already running. Resolves to whether it ran. */
	async run(task: () => Promise<void>): Promise<boolean> {
		if (this.busy) return false;
		this.busy = true;
		try {
			await task();
			return true;
		} finally {
			// Released on failure too: one rejected switch must not lock the search
			// out until Obsidian restarts.
			this.busy = false;
		}
	}
}
