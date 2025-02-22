import { createJsonResponse } from '../api/response';
import { ApiErrorResponse, ApiSubmitAnswerResponse } from '../types';
import { Session } from '../durableObjects/session';
import {
	calculateLogoQuizScore,
	generateLogoUrl,
	calculateTimeTakenBonus,
	isValidAnswerSubmission,
	logInfo,
	logWarning,
	logError,
} from '../utils/';

/**
 * Processes an answer submission.
 */
export async function handleSubmitAnswer(session: Session, request: Request, baseUrl: string): Promise<Response> {
	try {
		if (!session.sessionData) {
			logWarning('answer_submission_no_session', session.sessionId);
			return createJsonResponse<ApiErrorResponse>({ error: 'No active session' }, 400);
		} else if (session.sessionData.lives <= 0) {
			logWarning('answer_submission_game_over', session.sessionId);
			return createJsonResponse<ApiErrorResponse>({ error: 'Game over' }, 400);
		}

		const body = await request.json();
		if (!isValidAnswerSubmission(body)) {
			logWarning('answer_submission_invalid_format', session.sessionId);
			return createJsonResponse<ApiErrorResponse>({ error: 'Invalid input format' }, 400);
		}

		const { questionNumber, brandId, timeTaken } = body;
		if (!session.sessionData.questions[questionNumber] || session.sessionData.currentQuestion !== questionNumber) {
			logWarning('answer_submission_invalid_question', session.sessionId, {
				currentQuestion: session.sessionData.currentQuestion,
				questionNumber,
			});
			return createJsonResponse<ApiErrorResponse>({ error: 'Invalid question number' }, 400);
		}

		const correctAnswer = session.sessionData.questions[questionNumber];
		const isCorrect = correctAnswer.brandId === brandId;
		logInfo('answer_submitted', session.sessionId, { questionNumber, isCorrect });

		session.sessionData.score += isCorrect ? calculateLogoQuizScore(correctAnswer.difficulty) : 0;
		session.sessionData.lives -= isCorrect ? 0 : 1;
		session.sessionData.currentQuestion += isCorrect ? 1 : 0;

		// If this was the final question and was correct, apply bonus and then complete the session.
		if (isCorrect && session.sessionData.currentQuestion === Object.keys(session.sessionData.questions).length) {
			if (timeTaken && timeTaken > 0) {
				const bonusScore = calculateTimeTakenBonus(timeTaken);
				session.sessionData.score += bonusScore;
				logInfo('answer_bonus_score_added', session.sessionId, { timeTaken, bonusScore });
			}

			logInfo('answer_session_completed', session.sessionId, { finalScore: session.sessionData.score });
			const response = createJsonResponse<ApiSubmitAnswerResponse>(
				{
					isCorrect,
					lives: session.sessionData.lives,
					score: session.sessionData.score,
					logo: generateLogoUrl(correctAnswer.mediaId, !isCorrect, baseUrl),
				},
				200,
			);
			session.sessionData = null;
			await session.state.storage.deleteAll();
			return response;
		}

		await session.state.storage.put(`session-${session.sessionId}`, session.sessionData);
		logInfo('answer_session_updated', session.sessionId, { sessionData: session.sessionData });

		return createJsonResponse<ApiSubmitAnswerResponse>(
			{
				isCorrect,
				lives: session.sessionData.lives,
				score: session.sessionData.score,
				logo: generateLogoUrl(correctAnswer.mediaId, !isCorrect, baseUrl),
			},
			200,
		);
	} catch (error) {
		logError('answer_submission_error', session.sessionId, error);
		return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to submit answer' }, 500);
	}
}
