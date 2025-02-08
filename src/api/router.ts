import { Router } from 'itty-router';
import { createJsonResponse } from '../utils/response';

const router = Router();

// Start a new session
router.get('/session/start', async (request, env) => {
	let sessionId = request.headers.get('session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
	}

	const id = env.SESSION_DO.idFromName(sessionId);
	const sessionObject = env.SESSION_DO.get(id);
	return sessionObject.fetch(request);
});

// Submit an answer
router.post('/session/answer', async (request, env) => {
	const sessionId = request.headers.get('session_id');
	if (!sessionId) {
		return createJsonResponse({ error: 'Missing session ID' }, 400);
	}

	const id = env.SESSION_DO.idFromName(sessionId);
	const sessionObject = env.SESSION_DO.get(id);

	return sessionObject.fetch(request);
});

// End session
router.post('/session/end', async (request, env) => {
	const sessionId = request.headers.get('session_id');
	if (!sessionId) {
		return createJsonResponse({ error: 'Missing session ID' }, 400);
	}

	const id = env.SESSION_DO.idFromName(sessionId);
	const sessionObject = env.SESSION_DO.get(id);

	return sessionObject.fetch(request);
});

export default router;
