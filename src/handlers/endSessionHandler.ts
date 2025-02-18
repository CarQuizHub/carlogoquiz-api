import { createJsonResponse } from '../api/response';
import { Session } from '../durableObjects/session';
import { logInfo, logError } from '../utils/';
import { ApiErrorResponse } from '../types';

/**
 * Ends the session and clears stored data.
 */
export async function handleEndSession(session: Session): Promise<Response> {
	try {
		logInfo('session_end', session.sessionId, { finalScore: session.sessionData?.score ?? -1 });
		await session.state.storage.deleteAll();
		session.sessionData = null;
		return createJsonResponse({ message: 'Session ended and memory cleared' }, 200);
	} catch (error) {
		logError('session_end_error', session.sessionId, error);
		return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to end session' }, 500);
	}
}
