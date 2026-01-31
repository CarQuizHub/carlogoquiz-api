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

export async function handleSubmitAnswer(session: Session, answerData: AnswerRequest, baseUrl: string): Promise<SubmitAnswerResult> {
	try {
		if (!session.sessionData) {
			logWarning('answer_submission_no_session', session.state.id.toString());
			return {
				success: false,
				error: { code: SessionErrorCode.NO_ACTIVE_SESSION, message: 'No active session' },
			};
		} else if (session.sessionData.lives <= 0) {
			logWarning('answer_submission_game_over', session.state.id.toString());
			return {
				success: false,
				error: { code: SessionErrorCode.GAME_OVER, message: 'Game over' },
			};
		}

		if (!isValidAnswerSubmission(answerData)) {
			logWarning('answer_submission_invalid_format', session.state.id.toString());
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_INPUT_FORMAT, message: 'Invalid input format' },
			};
		}

		const { questionNumber, brandId, timeTaken } = answerData;

		if (!session.sessionData.questions[questionNumber] || session.sessionData.currentQuestion !== questionNumber) {
			logWarning('answer_submission_invalid_question', session.state.id.toString(), {
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

		logInfo('answer_submitted', session.state.id.toString(), { questionNumber, isCorrect });

		session.sessionData.score += isCorrect ? calculateLogoQuizScore(correctAnswer.difficulty) : 0;
		session.sessionData.lives -= isCorrect ? 0 : 1;
		session.sessionData.currentQuestion += isCorrect ? 1 : 0;

		if (isCorrect && session.sessionData.currentQuestion === Object.keys(session.sessionData.questions).length) {
			if (timeTaken && timeTaken > 0) {
				const bonusScore = calculateTimeTakenBonus(timeTaken);
				session.sessionData.score += bonusScore;
				logInfo('answer_bonus_score_added', session.state.id.toString(), { timeTaken, bonusScore });
			}

			logInfo('answer_session_completed', session.state.id.toString(), { finalScore: session.sessionData.score });

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

		await session.state.storage.put('state', session.sessionData);

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
		logError('answer_submission_error', session.state.id.toString(), error);
		return {
			success: false,
			error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to submit answer' },
		};
	}
}
