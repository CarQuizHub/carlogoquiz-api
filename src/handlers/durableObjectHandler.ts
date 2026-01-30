import { Context } from 'hono';
import { DurableObjectStub } from '@cloudflare/workers-types';
import { Result, SessionErrorCode } from '../types';
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
 * Maps SessionErrorCode to HTTP status code.
 */
function mapErrorCodeToStatus(code: SessionErrorCode): number {
	switch (code) {
		case SessionErrorCode.NO_BRANDS_AVAILABLE:
		case SessionErrorCode.NO_QUESTIONS_AVAILABLE:
		case SessionErrorCode.NO_ACTIVE_SESSION:
		case SessionErrorCode.GAME_OVER:
		case SessionErrorCode.INVALID_INPUT_FORMAT:
		case SessionErrorCode.INVALID_QUESTION_NUMBER:
			return 400;
		case SessionErrorCode.INTERNAL_ERROR:
		default:
			return 500;
	}
}

/**
 * Converts a Result<T> to an HTTP Response.
 * If the data contains a sessionId, it's also set as a response header for HTTP clients.
 */
function resultToResponse<T>(result: Result<T>): Response {
	if (result.success) {
		const data = result.data as Record<string, unknown>;
		const headers: Record<string, string> | undefined =
			data.sessionId && typeof data.sessionId === 'string' ? { session_id: data.sessionId } : undefined;
		return createJsonResponse(result.data, 200, headers);
	}
	const statusCode = mapErrorCodeToStatus(result.error.code);
	return createJsonResponse({ error: result.error.message }, statusCode);
}

/**
 * A generic handler for Session Durable Object actions.
 */
export async function handleSessionDurableObject<T>(
	c: Context,
	newSession: boolean,
	action: (stub: DurableObjectStub<Session>) => Promise<Result<T>>,
): Promise<Response> {
	try {
		const sessionId = getSessionId(c, newSession);
		if (!sessionId) {
			logWarning('session_missing_id', 'unknown');
			return createJsonResponse({ error: 'Missing session ID' }, 400);
		}
		const id = c.env.SESSION.idFromString(sessionId);
		const sessionStub = c.env.SESSION.get(id);
		const result = await retryDurableObject(() => action(sessionStub), sessionId);
		return resultToResponse(result);
	} catch (error) {
		logError('session_error', 'unknown', error);
		return createJsonResponse({ error: 'Failed to handle session' }, 500);
	}
}
