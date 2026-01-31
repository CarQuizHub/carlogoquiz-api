import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, AnswerRequest } from '../types';
import { CORS_OPTIONS } from '../config/constants';
import { createJsonResponse } from '../api/response';
import { logError } from '../utils/loggingUtils';
import { QuizApi } from '../services/quizApi';
import { resultToResponse } from '../handlers/durableObjectHandler';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors(CORS_OPTIONS));

app.onError((err, c) => {
	const sessionId = c.req.header('session_id') || 'unknown_session';
	logError('session_error', sessionId, err);
	return createJsonResponse({ error: 'Internal Server Error' }, 500);
});

app.get('/session/start', async (c) => {
	const api = new QuizApi(c.env);
	const result = await api.startSession();
	return resultToResponse(result);
});

app.get('/session/restore', async (c) => {
	const sessionId = c.req.header('session_id');
	if (!sessionId) return createJsonResponse({ error: 'Missing session_id header' }, 400);

	const api = new QuizApi(c.env);
	const result = await api.restoreSession(sessionId);
	return resultToResponse(result);
});

app.get('/session/end', async (c) => {
	const sessionId = c.req.header('session_id');
	if (!sessionId) return createJsonResponse({ error: 'Missing session_id header' }, 400);

	const api = new QuizApi(c.env);
	const result = await api.endSession(sessionId);
	return resultToResponse(result);
});

app.post('/session/answer', async (c) => {
	const sessionId = c.req.header('session_id');
	if (!sessionId) return createJsonResponse({ error: 'Missing session_id header' }, 400);

	let body: AnswerRequest;
	try {
		body = await c.req.json<AnswerRequest>();
	} catch {
		return createJsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const api = new QuizApi(c.env);
	const result = await api.submitAnswer(sessionId, body);
	return resultToResponse(result);
});

export default app;
