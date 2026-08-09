import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Logic only — the host application is never started.
		include: ['tests/**/*.test.ts'],
		environment: 'node',

		// A plugin imports "obsidian", which does not exist under test. Keep the
		// logic in files that do NOT import it and nothing needs stubbing; when
		// that is impossible, uncomment the alias and add a double in
		// tests/mocks/obsidian.ts.
		// alias: { obsidian: "./tests/mocks/obsidian.ts" },

		coverage: {
			reporter: ['text', 'html'],
			// No threshold to begin with. A threshold nobody enforces only buys
			// a red CI and a switched-off report.
			include: ['src/**/*.ts'],
		},
	},
});
