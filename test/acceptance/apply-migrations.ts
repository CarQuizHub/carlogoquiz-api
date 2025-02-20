// tests/apply-migrations.ts
import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:test';

async function applyMigrations() {
	if (!env.DB) {
		throw new Error('D1 Database is not defined in the test environment.');
	}

	console.log('Applying D1 Migrations...');
	await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
	console.log('✅ Migrations Applied Successfully!');
}

export default applyMigrations;
