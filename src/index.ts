import { Session } from './services/session/session';
import router from './api/router';
import { Env, ApiErrorResponse } from './types';
import { createJsonResponse } from './utils/response';

export { Session };

export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
		router.fetch(request, env, ctx).catch((err) => {
			const sessionId = request.headers.get('session_id') || 'unknown_session';

			console.error({
				event: 'unhandled_error',
				sessionId,
				error: err instanceof Error ? err.message : 'Unknown error occurred',
			});
			return createJsonResponse<ApiErrorResponse>({ error: 'Internal Server Error' }, 500);
		}),
};
