import type { SessionContext } from '../types/session';
import type { Brand, StoredQuestion, Bindings, Result, ApiStartSessionResponse } from '../types';
import { SessionErrorCode } from '../types';
import { fetchBrands } from '../repositories/brandRepository';
import { logInfo, logWarning, logError } from '../utils/';
import * as LogoUtils from '../utils/logoUtils';

export async function handleStartSession(session: SessionContext, env: Bindings): Promise<Result<ApiStartSessionResponse>> {
	try {
		const brands: Brand[] = await fetchBrands(env, session.sessionId);
		if (brands.length === 0) {
			logWarning('session_start_no_brands', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.NO_BRANDS_AVAILABLE, message: 'No brands available' },
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
			questions: storedQuestions,
			lives: 3,
			currentQuestion: 0,
		};

		await session.save();

		logInfo('session_started', session.sessionId, {
			questionCount: storedQuestions.length,
		});

		return {
			success: true,
			data: {
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
}
