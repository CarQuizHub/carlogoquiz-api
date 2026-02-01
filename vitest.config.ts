import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['test/unit/**/*.{test,spec}.ts'],
					exclude: ['**/node_modules/**', 'test/acceptance/**'],
				},
			},

			path.resolve(__dirname, 'test/acceptance/vitest.config.ts'),
		],
	},
});
