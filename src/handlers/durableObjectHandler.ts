import { Context } from 'hono';
import { JsonResponse } from '../types';
import { createJsonResponse } from '../api/response';
import { logWarning, logError } from '../utils/loggingUtils';
import { retryDurableObject } from '../api/retryDurableObject';
import { Session } from '../durableObjects/session';

/**
 * Retrieves the session ID from the request header. If it's missing and newSession is true, it creates a new one.
 */
export function getSessionId(c: Context, newSession: boolean): string | null {
	let sessionId = c.req.header('session_id');
	if (!sessionId && newSession) {
		const id = c.env.SESSION.newUniqueId();
		sessionId = id.toString();
	}
	return sessionId ?? null;
}

/**
 * A generic handler for Session Durable Object actions.
 */
export async function handleSessionDurableObject(
	c: Context,
	newSession: boolean,
	action: (stub: Session) => Promise<Response>,
): Promise<JsonResponse<Response>> {
	try {
		const sessionId = getSessionId(c, newSession);
		if (!sessionId) {
			logWarning('session_missing_id', 'unknown');
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}
		const id = c.env.SESSION.idFromString(sessionId);
		const sessionStub = c.env.SESSION.get(id) as Session;
		return await retryDurableObject(() => action(sessionStub));
	} catch (error) {
		logError('session_error', 'unknown', error);
		return createJsonResponse({ error: 'Failed to handle session' }, 500);
	}
}
