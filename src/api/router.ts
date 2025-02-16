import { AutoRouter } from 'itty-router';
import { createJsonResponse } from '../utils/response';

const router = AutoRouter();

router
	.get('/session/start', async (request, env) => {
		try {
			if (!(request instanceof Request)) {
				console.error('❌ request is not an instance of Request:', request);
				return createJsonResponse({ error: 'Invalid request object' }, 500);
			}

			let sessionId = request.headers.get('session_id');

			if (!sessionId) {
				sessionId = crypto.randomUUID();
				console.log('Generated new session_id:', sessionId);
			}

			const id = env.SESSION_DO.idFromName(sessionId);
			console.log('Durable Object ID:', id.toString());

			const sessionObject = env.SESSION_DO.get(id);

			return await sessionObject.fetch(
				new Request(request.url, {
					method: request.method,
					headers: request.headers,
					body: request.body,
				}),
			);
		} catch (error) {
			console.error('Error fetching sessionObject:', error);
			return createJsonResponse({ error: 'Failed to fetch session' }, 500);
		}
	})
	.post('/session/answer', async (request, env) => {
		if (!(request instanceof Request)) {
			console.error('❌ request is not an instance of Request:', request);
			return createJsonResponse({ error: 'Invalid request object' }, 500);
		}

		const sessionId = request.headers.get('session_id');
		if (!sessionId) {
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}

		const id = env.SESSION_DO.idFromName(sessionId);
		console.log('Durable Object ID:', id.toString());

		const sessionObject = env.SESSION_DO.get(id);

		if (!sessionObject) {
			return createJsonResponse({ error: 'Session object not found' }, 500);
		}

		return await sessionObject.fetch(request);
	})
	.post('/session/end', async (request, env) => {
		if (!(request instanceof Request)) {
			console.error('❌ request is not an instance of Request:', request);
			return createJsonResponse({ error: 'Invalid request object' }, 500);
		}

		const sessionId = request.headers.get('session_id');
		if (!sessionId) {
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}

		const id = env.SESSION_DO.idFromName(sessionId);
		console.log('Durable Object ID:', id.toString());

		const sessionObject = env.SESSION_DO.get(id);

		if (!sessionObject) {
			return createJsonResponse({ error: 'Session object not found' }, 500);
		}

		return await sessionObject.fetch(request);
	});

export default { ...router };
