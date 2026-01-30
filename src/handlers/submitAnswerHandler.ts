import { AnswerRequest, SubmitAnswerResult, SessionErrorCode } from '../types';
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
export async function handleSubmitAnswer(
	session: Session,
	answerData: AnswerRequest,
	baseUrl: string,
): Promise<SubmitAnswerResult> {
	try {
		if (!session.sessionData) {
			logWarning('answer_submission_no_session', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.NO_ACTIVE_SESSION, message: 'No active session' },
			};
		} else if (session.sessionData.lives <= 0) {
			logWarning('answer_submission_game_over', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.GAME_OVER, message: 'Game over' },
			};
		}

		if (!isValidAnswerSubmission(answerData)) {
			logWarning('answer_submission_invalid_format', session.sessionId);
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_INPUT_FORMAT, message: 'Invalid input format' },
			};
		}

		const { questionNumber, brandId, timeTaken } = answerData;
		if (!session.sessionData.questions[questionNumber] || session.sessionData.currentQuestion !== questionNumber) {
			logWarning('answer_submission_invalid_question', session.sessionId, {
				currentQuestion: session.sessionData.currentQuestion,
				questionNumber,
			});
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_QUESTION_NUMBER, message: 'Invalid question number' },
			};
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
			const result: SubmitAnswerResult = {
				success: true,
				data: {
					isCorrect,
					lives: session.sessionData.lives,
					score: session.sessionData.score,
					logo: generateLogoUrl(correctAnswer.mediaId, !isCorrect, baseUrl),
				},
			};
			session.sessionData = null;
			await session.state.storage.deleteAll();
			return result;
		}

		await session.state.storage.put(`session-${session.sessionId}`, session.sessionData);
		logInfo('answer_session_updated', session.sessionId, { sessionData: session.sessionData });

		return {
			success: true,
			data: {
				isCorrect,
				lives: session.sessionData.lives,
				score: session.sessionData.score,
				logo: generateLogoUrl(correctAnswer.mediaId, !isCorrect, baseUrl),
			},
		};
	} catch (error) {
		logError('answer_submission_error', session.sessionId, error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to submit answer' },
		};
	}
}
