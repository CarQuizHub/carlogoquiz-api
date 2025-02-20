// tests/setup.ts
import applyMigrations from './apply-migrations';

export default async function setup() {
	await applyMigrations();
}
