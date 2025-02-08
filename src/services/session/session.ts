import { DurableObject } from 'cloudflare:workers';
import { createJsonResponse } from '../../utils/response';
import { fetchBrands } from './brandRepository';
import { generateLogoQuestions, isValidAnswerSubmission, calculateLogoQuizScore } from './utils';
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
	private sessionData: SessionData | null = null; // Add a 'lastQuestion' property to the Session class to store the last question asked
	private sessionId: string;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionId = this.state.id.toString();

		state.blockConcurrencyWhile(async () => {
			const storedSession = await this.state.storage.get<SessionData>(`session-${this.sessionId}`);
			this.sessionData = storedSession ?? { score: 0, questions: {}, lives: 3 };
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/session/start':
				return this.startSession();
			case '/session/answer':
				return this.submitAnswer(request);
			case '/session/end':
				return this.endSession();
			default:
				return createJsonResponse<ApiErrorResponse>({ error: 'Not Found' }, 404);
		}
	}

	/** Starts a new session or restores an existing one */
	private async startSession(): JsonResponse<ApiStartSessionResponse> {
		try {
			const brands: Brand[] = await fetchBrands(this.env);
			if (brands.length === 0) {
				return createJsonResponse<ApiErrorResponse>({ error: 'No brands available' }, 400);
			}

			if (this.sessionData) {
				return createJsonResponse<ApiStartSessionResponse>(
					{
						sessionId: this.sessionId,
						brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
						questions: Object.values(this.sessionData.questions).map(({ logo }) => ({ question: { logo } })),
					},
					200,
					{ session_id: this.sessionId },
				);
			}

			const storedQuestions: StoredQuestion[] = generateLogoQuestions(brands);
			this.sessionData = {
				score: 0,
				questions: Object.fromEntries(storedQuestions.map((q, index) => [index, q])),
				lives: 3,
			};
			await this.state.storage.put(`session-${this.sessionId}`, this.sessionData);

			return createJsonResponse<ApiStartSessionResponse>(
				{
					sessionId: this.sessionId,
					brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
					questions: storedQuestions.map(({ logo }) => ({ question: { logo } })),
				},
				200,
				{ session_id: this.sessionId },
			);
		} catch (error) {
			console.error('Error starting session:', error);
			return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to start session' }, 500);
		}
	}

	/** Submits an answer and updates session data */
	private async submitAnswer(request: Request): JsonResponse<ApiSubmitAnswerResponse> {
		try {
			if (!this.sessionData) {
				return createJsonResponse<ApiErrorResponse>({ error: 'No active session' }, 400);
			}

			const body = await request.json();
			if (!isValidAnswerSubmission(body)) {
				return createJsonResponse<ApiErrorResponse>({ error: 'Invalid input format' }, 400);
			}

			const { questionNumber, brandId } = body;

			const correctAnswer = this.sessionData.questions[questionNumber];
			if (!correctAnswer) {
				return createJsonResponse<ApiErrorResponse>({ error: 'Invalid question number' }, 400);
			}

			const isCorrect = correctAnswer.brandId === brandId;
			this.sessionData.score += isCorrect ? calculateLogoQuizScore(correctAnswer.difficulty) : 0;
			this.sessionData.lives -= isCorrect ? 0 : 1;

			await this.state.storage.put(`session-${this.sessionId}`, this.sessionData);

			return createJsonResponse<ApiSubmitAnswerResponse>(
				{
					correct: isCorrect,
					lives: this.sessionData.lives,
					score: this.sessionData.score,
				},
				200,
			);
		} catch (error) {
			console.error('Error submitting answer:', error);
			return createJsonResponse<ApiErrorResponse>({ error: 'Error: Failed to submit answer' }, 500);
		}
	}

	/** Ends the session and clears stored data */
	private async endSession(): JsonResponse<{ message: string }> {
		await this.state.storage.delete(`session-${this.sessionId}`);
		this.sessionData = null;
		return createJsonResponse({ message: 'Session ended and memory cleared' }, 200);
	}
}
