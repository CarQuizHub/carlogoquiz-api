import type { SessionContext } from '../types/session';
import type { AnswerRequest, SubmitAnswerResult } from '../types';
import { SessionErrorCode } from '../types';
import {
	calculateLogoQuizScore,
	generateLogoUrl,
	calculateTimeTakenBonus,
	isValidAnswerSubmission,
	logInfo,
	logWarning,
	logError,
} from '../utils/';

export async function handleSubmitAnswer(session: SessionContext, answerData: AnswerRequest, baseUrl: string): Promise<SubmitAnswerResult> {
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

		const correctAnswer = session.sessionData.questions[questionNumber];
		if (!correctAnswer || session.sessionData.currentQuestion !== questionNumber) {
			logWarning('answer_submission_invalid_question', session.sessionId, {
				currentQuestion: session.sessionData.currentQuestion,
				questionNumber,
			});
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_QUESTION_NUMBER, message: 'Invalid question number' },
			};
		}

		const isCorrect = correctAnswer.brandId === brandId;

		logInfo('answer_submitted', session.sessionId, { questionNumber, isCorrect });

		session.sessionData.score += isCorrect ? calculateLogoQuizScore(correctAnswer.difficulty) : 0;
		session.sessionData.lives -= isCorrect ? 0 : 1;
		session.sessionData.currentQuestion += isCorrect ? 1 : 0;

		const isLastAnswered = isCorrect && session.sessionData.currentQuestion === session.sessionData.questions.length;

		if (isLastAnswered) {
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

			await session.clear();
			return result;
		}

		await session.save();

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
