import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Testy logiki, bez uruchamiania aplikacji-gospodarza.
		include: ['tests/**/*.test.ts'],
		environment: 'node',

		// Wtyczka Obsidiana importuje "obsidian", którego w testach nie ma.
		// Trzymaj logikę w plikach, które NIE importują tego modułu — wtedy
		// nie trzeba niczego podmieniać. Gdy się nie da, odkomentuj alias
		// i dopisz atrapę w tests/mocks/obsidian.ts.
		// alias: { obsidian: "./tests/mocks/obsidian.ts" },

		coverage: {
			reporter: ['text', 'html'],
			// Bez progu na start. Próg, którego nikt nie pilnuje,
			// to tylko czerwone CI i wyłączony raport.
			include: ['src/**/*.ts'],
		},
	},
});
