import type { Bindings } from '../../src/types';

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Bindings {
		TEST_MIGRATIONS: D1Migration[];
	}
}
