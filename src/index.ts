import router from './api/router';
import { Env } from './types';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			return await router.handle(request, env);
		} catch (error) {
			console.error('Unhandled error:', error);
			return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
		}
	},
};
