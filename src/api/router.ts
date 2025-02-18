import { AutoRouter } from 'itty-router';
import { createJsonResponse } from '../utils/response';

const router = AutoRouter();

router.options('*', () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	});
});

router
	.get('/session/start', async (request, env) => {
		try {
			let sessionId = request.headers.get('session_id');

			if (!sessionId) {
				const Id = env.SESSION_DO.newUniqueId();
				sessionId = Id.toString();
				console.log('Generated new session_id:', sessionId);
			}

			const id = env.SESSION_DO.idFromString(sessionId);
			console.log('Durable Object ID:', sessionId);

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
		const sessionId = request.headers.get('session_id');
		if (!sessionId) {
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}

		const id = env.SESSION_DO.idFromString(sessionId);
		console.log('Durable Object ID:', sessionId);

		const sessionObject = env.SESSION_DO.get(id);

		return await sessionObject.fetch(
			new Request(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
			}),
		);
	})
	.post('/session/end', async (request, env) => {
		const sessionId = request.headers.get('session_id');
		if (!sessionId) {
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}

		const id = env.SESSION_DO.idFromString(sessionId);
		console.log('Durable Object ID:', sessionId);

		const sessionObject = env.SESSION_DO.get(id);

		return await sessionObject.fetch(
			new Request(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
			}),
		);
	});

export default { ...router };
