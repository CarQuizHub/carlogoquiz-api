import type { Bindings, Result, ApiStartSessionResponse } from '../types';
import { fetchBrands } from '../repositories/brandRepository';
import { Session } from '../durableObjects/session';
import { logInfo, logWarning, logError } from '../utils/';
import { SessionErrorCode } from '../types';

export async function handleRestoreSession(session: Session, env: Bindings): Promise<Result<ApiStartSessionResponse>> {
	try {
		// session never started / was ended
		if (!session.sessionData || Object.keys(session.sessionData.questions).length === 0) {
			logWarning('session_restore_not_found', session.state.id.toString());
			return {
				success: false,
				error: { code: SessionErrorCode.SESSION_NOT_FOUND, message: 'Session not found or expired' },
			};
		}

		const brands = await fetchBrands(env, session.state.id.toString());

		logInfo('session_restored', session.state.id.toString());

		return {
			success: true,
			data: {
				brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
				questions: Object.values(session.sessionData.questions).map(({ logo }) => ({ question: { logo } })),
			},
		};
	} catch (error) {
		logError('session_restore_error', session.state.id.toString(), error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to restore session' },
		};
	}
}
