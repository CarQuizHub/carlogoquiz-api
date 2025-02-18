import { createJsonResponse } from '../api/response';
import { fetchBrands } from '../repositories/brandRepository';
import { generateLogoQuestions, logInfo, logWarning, logError } from '../utils/';
import { Session } from '../durableObjects/session';
import { ApiErrorResponse, ApiStartSessionResponse, Brand, StoredQuestion, Env } from '../types';

/**
 * Starts or restores a session.
 */
export async function handleStartSession(session: Session, env: Env): Promise<Response> {
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

		// Otherwise, start a new session
		const storedQuestions: StoredQuestion[] = generateLogoQuestions(brands, env);
		session.sessionData = {
			score: 0,
			questions: Object.fromEntries(storedQuestions.map((q, index) => [index, q])),
			lives: 3,
			currentQuestion: 0,
		};
		await session.state.storage.put(`session-${session.sessionId}`, session.sessionData);
		logInfo('session_started', session.sessionId, { sessionData: session.sessionData });

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
}
