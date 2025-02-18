import { DurableObject } from 'cloudflare:workers';
import { createJsonResponse } from '../../utils/response';
import { fetchBrands } from './brandRepository';
import { generateLogoQuestions, isValidAnswerSubmission, calculateLogoQuizScore, GenerateLogoUrl, CalculateTimeTakenBonus } from './utils';
import {
	SessionData,
	Env,
	Brand,
	StoredQuestion,
	ApiErrorResponse,
	ApiStartSessionResponse,
	ApiSubmitAnswerResponse,
	JsonResponse,
} from '../../types';

export class Session extends DurableObject {
	public env: Env;
	private state: DurableObjectState;
	private sessionData: SessionData | null = null;
	private sessionId: string;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionId = this.state.id.toString();
		state.blockConcurrencyWhile(async () => {
			let storedSession = await state.storage.get<SessionData>(`session-${this.sessionId}`);
			this.sessionData = {
				score: storedSession?.score ?? 0,
				lives: storedSession?.lives ?? 3,
				currentQuestion: storedSession?.currentQuestion ?? 0,
				questions: storedSession?.questions ?? {},
			};
			console.log({ event: 'session_initialized', sessionId: this.sessionId, sessionData: this.sessionData });
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/session/start':
				console.log({ event: 'session_start_request', sessionId: this.sessionId });
				return this.startSession();
			case '/session/answer':
				console.log({ event: 'session_answer_request', sessionId: this.sessionId });
				return this.submitAnswer(request);
			case '/session/end':
				console.log({ event: 'session_end_request', sessionId: this.sessionId });
				return this.endSession();
			default:
				console.warn({ event: 'unknown_route', sessionId: this.sessionId, path: url.pathname });
				return createJsonResponse<ApiErrorResponse>({ error: 'Not Found' }, 404);
		}
	}

	/** Starts a new session or restores an existing one */
	private async startSession(): JsonResponse<ApiStartSessionResponse> {
		try {
			const brands: Brand[] = await fetchBrands(this.env, this.sessionId);
			if (brands.length === 0) {
				console.warn({ event: 'session_start_no_brands', sessionId: this.sessionId });
				return createJsonResponse<ApiErrorResponse>({ error: 'No brands available' }, 400);
			}

			if (this.sessionData && Object.keys(this.sessionData.questions).length > 0) {
				console.log({ event: 'session_restored', sessionId: this.sessionId });
				return createJsonResponse<ApiStartSessionResponse>(
					{
						brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
						questions: Object.values(this.sessionData.questions).map(({ logo }) => ({ question: { logo } })),
					},
					200,
					{ session_id: this.sessionId },
				);
			}

			const storedQuestions: StoredQuestion[] = generateLogoQuestions(brands, this.env);
			this.sessionData = {
				score: 0,
				questions: Object.fromEntries(storedQuestions.map((q, index) => [index, q])),
				lives: 3,
				currentQuestion: 0,
			};
			await this.state.storage.put(`session-${this.sessionId}`, this.sessionData);
			console.log({ event: 'session_started', sessionId: this.sessionId });

			return createJsonResponse<ApiStartSessionResponse>(
				{
					brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
					questions: storedQuestions.map(({ logo }) => ({ question: { logo } })),
				},
				200,
				{ session_id: this.sessionId },
			);
		} catch (error) {
			console.error({
				event: 'session_start_error',
				sessionId: this.sessionId,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			});
			return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to start session' }, 500);
		}
	}

	/** Submits an answer and updates session data */
	private async submitAnswer(request: Request): JsonResponse<ApiSubmitAnswerResponse> {
		try {
			if (!this.sessionData) {
				console.warn({ event: 'answer_submission_no_session', sessionId: this.sessionId });
				return createJsonResponse<ApiErrorResponse>({ error: 'No active session' }, 400);
			} else if (this.sessionData.lives <= 0) {
				console.warn({ event: 'answer_submission_game_over', sessionId: this.sessionId });
				return createJsonResponse<ApiErrorResponse>({ error: 'Game over' }, 400);
			}

			const body = await request.json();
			if (!isValidAnswerSubmission(body)) {
				console.warn({ event: 'answer_submission_invalid_format', sessionId: this.sessionId });
				return createJsonResponse<ApiErrorResponse>({ error: 'Invalid input format' }, 400);
			}

			const { questionNumber: questionNumber, brandId: brandId, timeTaken: timeTaken } = body;

			if (!this.sessionData.questions[questionNumber] || this.sessionData.currentQuestion !== questionNumber) {
				console.warn({
					event: 'answer_submission_invalid_question',
					sessionId: this.sessionId,
					currentQuestion: this.sessionData.currentQuestion,
					questionNumber,
				});
				return createJsonResponse<ApiErrorResponse>({ error: 'Invalid question number' }, 400);
			}

			const correctAnswer = this.sessionData.questions[questionNumber];
			const isCorrect = correctAnswer.brandId === brandId;
			console.log({ event: 'answer_submitted', sessionId: this.sessionId, questionNumber, isCorrect });

			this.sessionData.score += isCorrect ? calculateLogoQuizScore(correctAnswer.difficulty) : 0;
			this.sessionData.lives -= isCorrect ? 0 : 1;
			this.sessionData.currentQuestion += isCorrect ? 1 : 0;

			if (isCorrect && this.sessionData.currentQuestion === Object.keys(this.sessionData.questions).length) {
				if (timeTaken && timeTaken > 0) {
					var bonusScore = CalculateTimeTakenBonus(timeTaken);
					this.sessionData.score += bonusScore;
					console.log({ event: 'answer_bonus_score_added', sessionId: this.sessionId, timeTaken, bonusScore });
				}

				console.log({ event: 'answer_session_completed', sessionId: this.sessionId, finalScore: this.sessionData.score });
				const response = createJsonResponse<ApiSubmitAnswerResponse>(
					{
						isCorrect: isCorrect,
						lives: this.sessionData.lives,
						score: this.sessionData.score,
						logo: GenerateLogoUrl(correctAnswer.mediaId, !isCorrect, this.env.MEDIA_BASE_URL),
					},
					200,
				);

				this.sessionData = null;
				await this.state.storage.deleteAll();
				return response;
			}

			await this.state.storage.put(`session-${this.sessionId}`, this.sessionData);
			console.log({ event: 'answer_session_updated', sessionId: this.sessionId, sessionData: this.sessionData });

			return createJsonResponse<ApiSubmitAnswerResponse>(
				{
					isCorrect: isCorrect,
					lives: this.sessionData.lives,
					score: this.sessionData.score,
					logo: GenerateLogoUrl(correctAnswer.mediaId, !isCorrect, this.env.MEDIA_BASE_URL),
				},
				200,
			);
		} catch (error) {
			console.error({
				event: 'answer_submission_error',
				sessionId: this.sessionId,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			});
			return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to submit answer' }, 500);
		}
	}

	/** Ends the session and clears stored data */
	private async endSession(): JsonResponse<{ message: string }> {
		try {
			console.log({ event: 'session_end', sessionId: this.sessionId, finalScore: this.sessionData?.score });
			await this.state.storage.deleteAll();
			this.sessionData = null;
			return createJsonResponse({ message: 'Session ended and memory cleared' }, 200);
		} catch (error) {
			console.error({
				event: 'session_end_error',
				sessionId: this.sessionId,
				error: error instanceof Error ? error.message : 'Unknown error occurred',
			});
			return createJsonResponse({ error: 'Error: Failed to end session' }, 500);
		}
	}
}
