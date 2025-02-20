import { createJsonResponse } from '../api/response';
import { fetchBrands } from '../repositories/brandRepository';
import { logInfo, logWarning, logError } from '../utils/';
import * as LogoUtils from '../../src/utils/logoUtils';
import { Session } from '../durableObjects/session';
import { ApiErrorResponse, ApiStartSessionResponse, Brand, StoredQuestion, Bindings } from '../types';

/**
 * Starts or restores a session.
 */
export const handleStartSession = async (session: Session, env: Bindings): Promise<Response> => {
	try {
		const brands: Brand[] = await fetchBrands(env, session.sessionId);
		if (brands.length === 0) {
			logWarning('session_start_no_brands', session.sessionId);
			return createJsonResponse<ApiErrorResponse>({ error: 'No brands available' }, 400);
		}

		// Restore session if already started
		if (session.sessionData && Object.keys(session.sessionData.questions).length > 0) {
			logInfo('session_restored', session.sessionId);
			return createJsonResponse<ApiStartSessionResponse>(
				{
					brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
					questions: Object.values(session.sessionData.questions).map(({ logo }) => ({ question: { logo } })),
				},
				200,
				{ session_id: session.sessionId },
			);
		}

		const storedQuestions: StoredQuestion[] = LogoUtils.generateLogoQuestions(brands, env);
		if (storedQuestions.length === 0) {
			logWarning('session_start_no_questions', session.sessionId);
			return createJsonResponse<ApiErrorResponse>({ error: 'No questions available' }, 400);
		}

		session.sessionData = {
			score: 0,
			questions: Object.fromEntries(storedQuestions.map((q, index) => [index, q])),
			lives: 3,
			currentQuestion: 0,
		};
		await session.state.storage.put(`session-${session.sessionId}`, session.sessionData);
		logInfo('session_started', session.sessionId, { sessionData: JSON.stringify(session.sessionData, null, 2) });

		return createJsonResponse<ApiStartSessionResponse>(
			{
				brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
				questions: storedQuestions.map(({ logo }) => ({ question: { logo } })),
			},
			200,
			{ session_id: session.sessionId },
		);
	} catch (error) {
		logError('session_start_error', session.sessionId, error);
		return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to start session' }, 500);
	}
};
