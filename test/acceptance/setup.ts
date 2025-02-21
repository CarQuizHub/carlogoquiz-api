import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

beforeAll(async () => {
	if (!env.DB) {
		throw new Error('D1Database binding (DB) is not available in the test environment.');
	}
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
