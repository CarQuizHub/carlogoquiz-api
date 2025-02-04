import { Router } from 'itty-router';

const router = Router();

// Start a new session
router.get('/session/start', async (request, env) => {
	const id = crypto.randomUUID();
	const response = await env.SESSION_DO.get(id).fetch(new Request(request.url));
	const responseData = await response.json();

	return new Response(JSON.stringify({ session_id: id, ...responseData }), {
		headers: { 'Content-Type': 'application/json' },
	});
});

// Submit an answer
router.post('/session/answer', async (request, env) => {
	const session_id = request.headers.get('session_id');
	if (!session_id) return new Response('Missing session ID', { status: 400 });

	return await env.SESSION_DO.get(session_id).fetch(
		new Request(request.url, {
			method: 'POST',
			body: JSON.stringify(await request.json()),
			headers: { 'Content-Type': 'application/json' },
		}),
	);
});

export default router;
