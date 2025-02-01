import { Router } from 'itty-router';

const router = Router();

// Start a new session
router.get('/session/start', async (request, env) => {
	const id = crypto.randomUUID();
	await env.SESSION_DO.get(id).fetch(new Request(request.url));
	return new Response(JSON.stringify({ session_id: id }), {
		headers: { 'Content-Type': 'application/json' },
	});
});

// Generate a new question with required difficulty parameter
router.get('/session/question', async (request, env) => {
	const session_id = request.headers.get('session_id');
	const url = new URL(request.url);
	const difficulty = url.searchParams.get('difficulty');

	if (!session_id) return new Response('Missing session ID', { status: 400 });
	if (!difficulty) return new Response('Missing difficulty parameter', { status: 400 });

	return await env.SESSION_DO.get(session_id).fetch(
		new Request(request.url, {
			method: 'GET',
			headers: { Difficulty: difficulty },
		}),
	);
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
