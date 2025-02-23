import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig(async () => {
	// Read SQL migration files from the "migrations" directory
	const migrationsPath = path.join(__dirname, '../../migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			globals: true,
			setupFiles: [path.resolve(__dirname, './setup.ts')],
			poolOptions: {
				workers: {
					singleWorker: true,
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
