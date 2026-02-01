import { fetchBrands } from '../repositories/brandRepository';
import { logInfo, logWarning, logError } from '../utils/';
import * as LogoUtils from '../utils/logoUtils';
import { Session } from '../durableObjects/session';
import type { Brand, StoredQuestion, Bindings, Result, ApiStartSessionResponse } from '../types';
import { SessionErrorCode } from '../types';

export const handleStartSession = async (session: Session, env: Bindings): Promise<Result<ApiStartSessionResponse>> => {
	try {
		const brands: Brand[] = await fetchBrands(env, session.state.id.toString());
		if (brands.length === 0) {
			logWarning('session_start_no_brands', session.state.id.toString());
			return {
				success: false,
				error: { code: SessionErrorCode.NO_BRANDS_AVAILABLE, message: 'No brands available' },
			};
		}

		const storedQuestions: StoredQuestion[] = LogoUtils.generateLogoQuestions(brands, env.MEDIA_BASE_URL);
		if (storedQuestions.length === 0) {
			logWarning('session_start_no_questions', session.state.id.toString());
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

		logInfo('session_started', session.state.id.toString(), {
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
		logError('session_start_error', session.state.id.toString(), error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to start session' },
		};
	}
};
