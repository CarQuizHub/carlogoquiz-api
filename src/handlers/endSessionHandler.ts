import type { SessionContext } from '../types/session';
import type { EndSessionResult } from '../types';
import { SessionErrorCode } from '../types';
import { logInfo, logError } from '../utils/';

export async function handleEndSession(session: SessionContext): Promise<EndSessionResult> {
	try {
		logInfo('session_end', session.sessionId, { finalScore: session.sessionData?.score ?? -1 });

		await session.clear();

		return { success: true, data: { message: 'Session ended and memory cleared' } };
	} catch (error) {
		logError('session_end_error', session.sessionId, error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to end session' },
		};
	}
}
