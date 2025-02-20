import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSubmitAnswer } from '../../src/handlers/submitAnswerHandler';
import { calculateTimeTakenBonus } from '../../src/utils/questionUtils';
import type { SessionData, Bindings } from '../../src/types';

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
	let mockRequest: any;

	beforeEach(() => {
		vi.clearAllMocks();

		fakeEnv = {
			MEDIA_BASE_URL: 'https://cdn.example.com',
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

	const testSubmitAnswer = async (body: any, expectedStatus: number, expectedData: any) => {
		mockRequest = { json: vi.fn().mockResolvedValue(body) } as any;
		const response = await handleSubmitAnswer(fakeSession, mockRequest);
		const data = await response.json();
		expect(response.status).toBe(expectedStatus);
		expect(data).toEqual(expectedData);
	};

	it('processes a correct answer and updates session', async () => {
		await testSubmitAnswer({ questionNumber: 0, brandId: 1 }, 200, {
			isCorrect: true,
			lives: 3,
			score: 10,
			logo: 'https://cdn.example.com/media1',
		});
		expect(fakeSession.state.storage.put).toHaveBeenCalled();
	});

	it('processes an incorrect answer and updates session', async () => {
		await testSubmitAnswer({ questionNumber: 0, brandId: 2, timeTaken: 5 }, 200, {
			isCorrect: false,
			lives: 2,
			score: 0,
			logo: 'https://cdn.example.com/media1_wrong',
		});
		expect(fakeSession.state.storage.put).toHaveBeenCalled();
	});

	it('completes session when final question is answered correctly', async () => {
		// Answer the first question correctly
		await testSubmitAnswer({ questionNumber: 0, brandId: 1, timeTaken: 5 }, 200, {
			isCorrect: true,
			lives: 3,
			score: 10,
			logo: 'https://cdn.example.com/media1',
		});
		expect(fakeSession.sessionData.currentQuestion).toBe(1);

		// Answer the final question correctly
		await testSubmitAnswer({ questionNumber: 1, brandId: 2, timeTaken: 5 }, 200, {
			isCorrect: true,
			lives: 3,
			score: 25, // 10 + 10 + 5 bonus
			logo: 'https://cdn.example.com/media2',
		});

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(calculateTimeTakenBonus).toHaveBeenCalledWith(5);
	});

	it('returns an error when no active session exists', async () => {
		fakeSession.sessionData = null;
		await testSubmitAnswer({ questionNumber: 0, brandId: 1, timeTaken: 5 }, 400, { error: 'No active session' });
	});

	it('returns an error when the game is over', async () => {
		fakeSession.sessionData.lives = 0;
		await testSubmitAnswer({ questionNumber: 0, brandId: 1, timeTaken: 5 }, 400, { error: 'Game over' });
	});

	it('returns an error when request format is invalid', async () => {
		await testSubmitAnswer({}, 400, { error: 'Invalid input format' });
	});

	it('returns an error when answering an invalid question', async () => {
		await testSubmitAnswer({ questionNumber: 1, brandId: 1, timeTaken: 5 }, 400, { error: 'Invalid question number' });
	});

	it('handles unexpected errors gracefully', async () => {
		mockRequest = { json: vi.fn().mockRejectedValue(new Error('Unexpected error')) } as any;

		const response = await handleSubmitAnswer(fakeSession, mockRequest);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({ error: 'Error: Failed to submit answer' });
	});
});
