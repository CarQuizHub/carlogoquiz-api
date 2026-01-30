import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSubmitAnswer } from '../../src/handlers/submitAnswerHandler';
import { calculateTimeTakenBonus } from '../../src/utils/questionUtils';
import type { SessionData, Bindings, AnswerRequest } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

vi.mock('../../src/utils/logoUtils', () => ({
	generateLogoUrl: vi.fn((mediaId, incorrect, baseUrl) => `${baseUrl}/${mediaId}${incorrect ? '_wrong' : ''}`),
	calculateLogoQuizScore: vi.fn(() => 10),
}));

vi.mock('../../src/utils/questionUtils', () => ({
	calculateTimeTakenBonus: vi.fn(() => 5),
}));

describe('handleSubmitAnswer', () => {
	let fakeSession: any;
	let fakeEnv: Bindings;
	const MEDIA_BASE_URL = 'https://cdn.example.com';

	beforeEach(() => {
		vi.clearAllMocks();

		fakeEnv = {
			MEDIA_BASE_URL: MEDIA_BASE_URL,
			PRODUCTION: false,
		} as any;

		fakeSession = {
			sessionId: 'test-session',
			env: fakeEnv,
			sessionData: {
				score: 0,
				lives: 3,
				currentQuestion: 0,
				questions: {
					0: { logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
					1: { logo: 'logo2.png', brandId: 2, difficulty: 3, mediaId: 'media2' },
				},
			} as SessionData,
			state: {
				storage: {
					put: vi.fn().mockResolvedValue(undefined),
					deleteAll: vi.fn().mockResolvedValue(undefined),
				},
			},
		} as any;
	});

	it('processes a correct answer and updates session', async () => {
		const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: null };
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({
				isCorrect: true,
				lives: 3,
				score: 10,
				logo: 'https://cdn.example.com/media1',
			});
		}
		expect(fakeSession.state.storage.put).toHaveBeenCalled();
	});

	it('processes an incorrect answer and updates session', async () => {
		const answerData: AnswerRequest = { questionNumber: 0, brandId: 2, timeTaken: 5 };
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({
				isCorrect: false,
				lives: 2,
				score: 0,
				logo: 'https://cdn.example.com/media1_wrong',
			});
		}
		expect(fakeSession.state.storage.put).toHaveBeenCalled();
	});

	it('completes session when final question is answered correctly', async () => {
		// Answer the first question correctly
		const answerData1: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
		const result1 = await handleSubmitAnswer(fakeSession, answerData1, MEDIA_BASE_URL);

		expect(result1.success).toBe(true);
		if (result1.success) {
			expect(result1.data).toEqual({
				isCorrect: true,
				lives: 3,
				score: 10,
				logo: 'https://cdn.example.com/media1',
			});
		}
		expect(fakeSession.sessionData.currentQuestion).toBe(1);

		// Answer the final question correctly
		const answerData2: AnswerRequest = { questionNumber: 1, brandId: 2, timeTaken: 5 };
		const result2 = await handleSubmitAnswer(fakeSession, answerData2, MEDIA_BASE_URL);

		expect(result2.success).toBe(true);
		if (result2.success) {
			expect(result2.data).toEqual({
				isCorrect: true,
				lives: 3,
				score: 25, // 10 + 10 + 5 bonus
				logo: 'https://cdn.example.com/media2',
			});
		}

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(calculateTimeTakenBonus).toHaveBeenCalledWith(5);
	});

	it('returns an error when no active session exists', async () => {
		fakeSession.sessionData = null;
		const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
			expect(result.error.message).toBe('No active session');
		}
	});

	it('returns an error when the game is over', async () => {
		fakeSession.sessionData.lives = 0;
		const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.GAME_OVER);
			expect(result.error.message).toBe('Game over');
		}
	});

	it('returns an error when request format is invalid', async () => {
		const answerData = {} as AnswerRequest;
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
			expect(result.error.message).toBe('Invalid input format');
		}
	});

	it('returns an error when answering an invalid question', async () => {
		const answerData: AnswerRequest = { questionNumber: 1, brandId: 1, timeTaken: 5 };
		const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
			expect(result.error.message).toBe('Invalid question number');
		}
	});
});
