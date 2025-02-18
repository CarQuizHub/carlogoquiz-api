import { AutoRouter } from 'itty-router';
import { CORS_HEADERS } from '../config/constants';
import { createJsonResponse } from './response';
import { JsonResponse } from '../types';
import { logInfo, logWarning, logError } from '../utils/loggingUtils';

const router = AutoRouter();

router.options(
	'*',
	() =>
		new Response(null, {
			status: 204,
			headers: CORS_HEADERS,
		}),
);

router.get('/session/start', async (request, env) => forwardSessionRequest(request, env, true));
router.post('/session/*', async (request, env) => forwardSessionRequest(request, env, false));

async function forwardSessionRequest(request: Request, env: any, createId: boolean): Promise<JsonResponse<Response>> {
	try {
		let sessionId = request.headers.get('session_id');
		if (!sessionId && createId) {
			const id = env.SESSION_DO.newUniqueId();
			sessionId = id.toString();
		}

		if (!sessionId) {
			logWarning('session_missing_id', 'unknown');
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}

		const id = env.SESSION_DO.idFromString(sessionId);
		const sessionObject = env.SESSION_DO.get(id);

		return await sessionObject.fetch(
			new Request(request.url, {
				method: request.method,
				body: request.body,
			}),
		);
	} catch (error) {
		logError('session_error', 'unknown', error);
		return createJsonResponse({ error: 'Failed to handle session' }, 500);
	}
}

export default { ...router };
