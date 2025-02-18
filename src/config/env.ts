import { DurableObjectNamespace } from '@cloudflare/workers-types';
import { Session } from '../durableObjects/session';

export interface Env {
	DB: D1Database;
	BRANDS_KV: KVNamespace;
	SESSION_DO: DurableObjectNamespace<Session>;
	MEDIA_BASE_URL: string;
	PRODUCTION: boolean;
	BRANDS_CACHE_DURATION: string;
}
