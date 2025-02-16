import { Session } from './services/session/session'; // Ensure the correct path
import router from './api/router';
import { Env } from './types';
import { error } from 'itty-router';

export { Session };

export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
		router.fetch(request, env, ctx).catch((err) => {
			console.error('Unhandled error:', err);
			return error(500, 'Internal Server Error');
		}),
};
