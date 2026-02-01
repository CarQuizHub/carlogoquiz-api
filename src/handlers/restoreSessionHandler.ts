import type { SessionContext } from '../types/session';
import type { Bindings, Result, ApiStartSessionResponse } from '../types';
import { SessionErrorCode } from '../types';
import { fetchBrands } from '../repositories/brandRepository';
import { logInfo, logWarning, logError } from '../utils/';

export async function handleRestoreSession(session: SessionContext, env: Bindings): Promise<Result<ApiStartSessionResponse>> {
	try {
		if (!session.sessionData || session.sessionData.questions.length === 0) {
			logWarning('session_restore_not_found', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.SESSION_NOT_FOUND, message: 'Session not found or expired' },
			};
		}

		const brands = await fetchBrands(env, session.sessionId);

		logInfo('session_restored', session.sessionId);

		return {
			success: true,
			data: {
				brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
				questions: session.sessionData.questions.map(({ logo }) => ({ question: { logo } })),
			},
		};
	} catch (error) {
		logError('session_restore_error', session.sessionId, error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to restore session' },
		};
	}
}
