import { DurableObject } from 'cloudflare:workers';
import { createJsonResponse } from '../../utils/response';
import { SessionData, Env, AnswerSubmission, Brand, Question, StoredQuestion } from '../../types';
import { fetchBrands } from './brandRepository';
import { generateLogoQuestions, isValidAnswerSubmission } from './utils';

export class Session extends DurableObject {
	public env: Env;
	private state: DurableObjectState;
	private sessionData: SessionData;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionData = { score: 0, questions: {} };
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/session/start':
				return this.startSession();
			case '/session/answer':
				return this.submitAnswer(request);
			default:
				return createJsonResponse({ error: 'Not Found' }, 404);
		}
	}

	private async startSession(): Promise<Response> {
		try {
			const brands: Brand[] = await fetchBrands(this.env);
			if (brands.length === 0) {
				return createJsonResponse({ error: 'No brands available' }, 400);
			}

			const storedQuestions: StoredQuestion[] = generateLogoQuestions(brands);

			this.sessionData.questions = Object.fromEntries(storedQuestions.map((q, index) => [index, q]));

			const frontendQuestions: Question[] = storedQuestions.map(({ logo }) => ({ logo }));

			return createJsonResponse({
				brands: brands.map(({ id, brand_name }) => ({ id, brand_name })),
				questions: frontendQuestions,
			});
		} catch (error) {
			console.error('Error starting session:', error);
			return createJsonResponse({ error: 'Error: Failed to start session' }, 500);
		}
	}

	private async submitAnswer(request: Request): Promise<Response> {
		try {
			const body: unknown = await request.json();
			if (!isValidAnswerSubmission(body)) {
				return createJsonResponse({ error: 'Invalid input format' }, 400);
			}

			const { questionNumber, brandId } = body;

			const correctAnswer = this.sessionData.questions[questionNumber];
			if (!correctAnswer) {
				return createJsonResponse({ error: 'Invalid question number' }, 400);
			}

			const isCorrect = correctAnswer.brandId === brandId;
			if (isCorrect) {
				this.sessionData.score += 1;
			}

			return createJsonResponse({ correct: isCorrect, score: this.sessionData.score });
		} catch (error) {
			console.error('Error submitting answer:', error);
			return createJsonResponse({ error: 'Error: Failed to submit answer' }, 500);
		}
	}
}
