import { fetchBrands } from '../repositories/brandRepository';
import { logInfo, logWarning, logError } from '../utils/';
import * as LogoUtils from '../../src/utils/logoUtils';
import { Session } from '../durableObjects/session';
import { Brand, StoredQuestion, Bindings, StartSessionResult, SessionErrorCode } from '../types';

/**
 * Starts or restores a session.
 */
export const handleStartSession = async (session: Session, env: Bindings): Promise<StartSessionResult> => {
	try {
		const brands: Brand[] = await fetchBrands(env, session.sessionId);
		if (brands.length === 0) {
			logWarning('session_start_no_brands', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.NO_BRANDS_AVAILABLE, message: 'No brands available' },
			};
		}

		// Restore session if already started
		if (session.sessionData && Object.keys(session.sessionData.questions).length > 0) {
			logInfo('session_restored', session.sessionId);
			return {
				success: true,
				data: {
					sessionId: session.sessionId,
					brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
					questions: Object.values(session.sessionData.questions).map(({ logo }) => ({ question: { logo } })),
				},
			};
		}

		const storedQuestions: StoredQuestion[] = LogoUtils.generateLogoQuestions(brands, env.MEDIA_BASE_URL);
		if (storedQuestions.length === 0) {
			logWarning('session_start_no_questions', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.NO_QUESTIONS_AVAILABLE, message: 'No questions available' },
			};
		}

		session.sessionData = {
			score: 0,
			questions: Object.fromEntries(storedQuestions.map((q, index) => [index, q])),
			lives: 3,
			currentQuestion: 0,
		};
		await session.state.storage.put(`session-${session.sessionId}`, session.sessionData);
		logInfo('session_started', session.sessionId, { sessionData: JSON.stringify(session.sessionData, null, 2) });

		return {
			success: true,
			data: {
				sessionId: session.sessionId,
				brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
				questions: storedQuestions.map(({ logo }) => ({ question: { logo } })),
			},
		};
	} catch (error) {
		logError('session_start_error', session.sessionId, error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to start session' },
		};
	}
};
