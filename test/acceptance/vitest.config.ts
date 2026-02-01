import path from 'path';

import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
	const migrationsPath = path.join(__dirname, '../../migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			name: 'acceptance',
			globals: true,
			setupFiles: [path.resolve(__dirname, './setup.ts'), path.resolve(__dirname, './testSetup.ts')],
			poolOptions: {
				workers: {
					wrangler: {
						configPath: '../../wrangler.json',
						env: 'dev',
					},
					miniflare: {
						kvNamespaces: ['BRANDS_KV'],
						d1Databases: {
							DB: ':memory:',
						},
						bindings: {
							TEST_MIGRATIONS: migrations,
						},
					},
				},
			},
			tsconfig: './tsconfig.json',
			threads: false,
		},
	};
});
