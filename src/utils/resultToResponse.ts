import { createJsonResponse } from '../api/response';
import { Result, SessionErrorCode } from '../types';

function mapErrorCodeToStatus(code: SessionErrorCode): number {
	switch (code) {
		case SessionErrorCode.NO_BRANDS_AVAILABLE:
		case SessionErrorCode.NO_QUESTIONS_AVAILABLE:
		case SessionErrorCode.INVALID_INPUT_FORMAT:
		case SessionErrorCode.INVALID_QUESTION_NUMBER:
		case SessionErrorCode.INVALID_SESSION_ID:
			return 400;

		case SessionErrorCode.SESSION_NOT_FOUND:
		case SessionErrorCode.NO_ACTIVE_SESSION:
			return 404;

		case SessionErrorCode.GAME_OVER:
			return 409;

		case SessionErrorCode.INTERNAL_ERROR:
		default:
			return 500;
	}
}

export function resultToResponse<T>(result: Result<T>): Response {
	if (result.success) {
		const headers = hasSessionId(result.data) ? { session_id: result.data.sessionId } : undefined;
		return createJsonResponse(result.data, 200, headers);
	}

	const statusCode = mapErrorCodeToStatus(result.error.code);
	return createJsonResponse({ error: result.error.message, code: result.error.code }, statusCode);
}

function hasSessionId(data: unknown): data is { sessionId: string } {
	return typeof (data as { sessionId?: unknown })?.sessionId === 'string';
}
