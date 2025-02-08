import router from './api/router';
import { Env } from './types';
import { createJsonResponse } from './utils/response';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			return await router.handle(request, env);
		} catch (error) {
			console.error('Unhandled error:', error);
			return createJsonResponse({ error: 'Internal Server Error' }, 500);
		}
	},
};
