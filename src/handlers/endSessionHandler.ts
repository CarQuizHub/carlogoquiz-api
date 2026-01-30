import { Session } from '../durableObjects/session';
import { logInfo, logError } from '../utils/';
import { EndSessionResult, SessionErrorCode } from '../types';

/**
 * Ends the session and clears stored data.
 */
export async function handleEndSession(session: Session): Promise<EndSessionResult> {
	try {
		logInfo('session_end', session.sessionId, { finalScore: session.sessionData?.score ?? -1 });
		await session.state.storage.deleteAll();
		session.sessionData = null;
		return { success: true, data: { message: 'Session ended and memory cleared' } };
	} catch (error) {
		logError('session_end_error', session.sessionId, error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to end session' },
		};
	}
}
