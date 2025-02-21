// vitest.config.ts
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig(async () => {
	// Read SQL migration files from the "migrations" directory
	const migrations = (await readD1Migrations(path.join(__dirname, '../../migrations'))) || [];

	return {
		test: {
			//setupFiles: ['./test/acceptance/setup.ts'], // Runs migrations before tests
			poolOptions: {
				workers: {
					singleWorker: true,
					wrangler: {
						configPath: '../../wrangler.json',
						env: 'dev',
					},
					miniflare: {
						bindings: {
							TEST_MIGRATIONS: migrations, // Inject migration SQL
						},
					},
				},
			},
			tsconfig: './test/acceptance/tsconfig.json',
			threads: false,
		},
	};
});
