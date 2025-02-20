// vitest.config.ts
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig(async () => {
	// Read SQL migration files from the "migrations" directory
	//const migrations = (await readD1Migrations(path.join(__dirname, 'migrations'))) || [];

	return {
		test: {
			setupFiles: ['./test/acceptance/setup.ts'], // Runs migrations before tests
			poolOptions: {
				workers: {
					wrangler: {
						configPath: './wrangler.json', // Ensure Wrangler knows about your DB
					},
					miniflare: {
						// Pass migrations to the test environment
						bindings: {
							//TEST_MIGRATIONS: migrations, // Inject migration SQL
						},
					},
				},
			},
			globals: true,
			tsconfig: './test/acceptance/tsconfig.json',
			threads: false,
		},
	};
});
