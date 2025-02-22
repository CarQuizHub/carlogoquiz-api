import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings } from '../types';
import { CORS_OPTIONS } from '../config/constants';
import { createJsonResponse } from '../api/response';
import { logError } from '../utils/loggingUtils';
import { handleSessionDurableObject } from '../handlers/durableObjectHandler';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors(CORS_OPTIONS));

app.onError((err, c) => {
	const sessionId = c.req.header('session_id') || 'unknown_session';
	logError('session_error', sessionId, err);
	return createJsonResponse({ error: 'Internal Server Error' }, 500);
});

// Route to start a session.
app.get('/session/start', async (c) => {
	return await handleSessionDurableObject(c, true, (stub) => stub.startSession());
});

// Route to end a session.
app.get('/session/end', async (c) => {
	return await handleSessionDurableObject(c, false, (stub) => stub.endSession());
});

// Route to submit answer to a question stored in session.
app.post('/session/answer', async (c) => {
	return await handleSessionDurableObject(c, false, (stub) => stub.submitAnswer(c.req.raw));
});

export default app;
