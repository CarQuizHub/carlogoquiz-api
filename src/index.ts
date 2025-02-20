import { Session } from './durableObjects/session';
import router from './api/router';
import { Bindings, ApiErrorResponse } from './types';
import { createJsonResponse } from './api/response';

export { Session };

export default {
	fetch: (request: Request, env: Bindings, ctx: ExecutionContext) =>
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
