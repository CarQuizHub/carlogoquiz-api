import { env, runInDurableObject, fetchMock } from 'cloudflare:test';
import { beforeAll, beforeEach, afterEach, describe, it, expect } from 'vitest';

import { QuizApi } from '../../src/services/quizApi';
import type { SessionData, AnswerRequest } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

// -------------------- Deterministic RNG --------------------
const ORIGINAL_RANDOM = Math.random;

function mulberry32(seed: number) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hash32(str: string) {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

beforeEach(() => {
	const name = (expect as any).getState?.().currentTestName ?? 'seed';
	Math.random = mulberry32(hash32(String(name)));
});

afterEach(() => {
	Math.random = ORIGINAL_RANDOM;
});

// -------------------- Helpers --------------------
function getApi(): QuizApi {
	return new QuizApi(env);
}

function getSessionStub(sessionId: string) {
	const id = env.SESSION.idFromString(sessionId);
	return env.SESSION.get(id);
}

async function getSessionState(sessionId: string): Promise<SessionData | null> {
	const stub = getSessionStub(sessionId);
	return await runInDurableObject(stub, async (_instance, state) => {
		const data = await state.storage.get('state');
		return (data as SessionData) ?? null;
	});
}

async function getSessionStateOrFail(sessionId: string): Promise<SessionData> {
	const sessionState = await getSessionState(sessionId);
	expect(sessionState, `Expected session state to exist for session ${sessionId}`).not.toBeNull();
	return sessionState as SessionData;
}

async function getCorrectBrandId(sessionId: string, questionNumber: number): Promise<number> {
	const sessionState = await getSessionStateOrFail(sessionId);
	return sessionState.questions[questionNumber].brandId;
}

function createAnswerRequest(questionNumber: number, brandId: number, timeTaken: number | null = null): AnswerRequest {
	return { questionNumber, brandId, timeTaken };
}

describe('startSession', () => {
	it('returns session with brands and questions', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.sessionId).toBeTruthy();
		expect(typeof result.data.sessionId).toBe('string');
		expect(result.data.brands).toHaveLength(89);
		expect(result.data.questions).toHaveLength(15);
	});

	it('returns brands with id and brand_name', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		const firstBrand = result.data.brands[0];
		expect(firstBrand).toHaveProperty('id');
		expect(firstBrand).toHaveProperty('brand_name');
		expect(typeof firstBrand.id).toBe('number');
		expect(typeof firstBrand.brand_name).toBe('string');
	});

	it('returns questions with valid logo URLs', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		result.data.questions.forEach((q) => {
			expect(q.question.logo).toMatch(/^http/);
			expect(q.question.logo).toContain('/brands/');
		});
	});

	it('generates unique session IDs', async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => getApi().startSession()));

		const sessionIds = results.filter((r) => r.success).map((r) => (r.success ? r.data.sessionId : null));

		expect(new Set(sessionIds).size).toBe(5);
	});

	it('initializes session state correctly', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		const sessionState = await getSessionStateOrFail(result.data.sessionId);

		expect(sessionState.score).toBe(0);
		expect(sessionState.lives).toBe(3);
		expect(sessionState.currentQuestion).toBe(0);
		expect(sessionState.questions).toHaveLength(15);
	});

	it('stores questions with brandId, difficulty, and mediaId', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		const sessionState = await getSessionStateOrFail(result.data.sessionId);
		const storedQuestion = sessionState.questions[0];

		expect(storedQuestion).toHaveProperty('brandId');
		expect(storedQuestion).toHaveProperty('difficulty');
		expect(storedQuestion).toHaveProperty('mediaId');
		expect(storedQuestion).toHaveProperty('logo');
	});
});

describe('restoreSession', () => {
	it('restores existing session with identical questions', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const restoreResult = await api.restoreSession(startResult.data.sessionId);

		expect(restoreResult.success).toBe(true);
		if (!restoreResult.success) return;

		expect(restoreResult.data.questions).toEqual(startResult.data.questions);
		expect(restoreResult.data.brands).toHaveLength(89);
	});

	it('returns same sessionId on restore', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const originalSessionId = startResult.data.sessionId;

		const restoreResult = await api.restoreSession(originalSessionId);
		expect(restoreResult.success).toBe(true);
		if (!restoreResult.success) return;

		expect(restoreResult.data.sessionId).toBe(originalSessionId);
	});

	it('returns INVALID_SESSION_ID for malformed session id', async () => {
		const result = await getApi().restoreSession('invalid-session-id');

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('returns INVALID_SESSION_ID for non-existent but valid format session id', async () => {
		const fakeSessionId = '0000000000000000000000000000000000000000000000000000000000000000';
		const result = await getApi().restoreSession(fakeSessionId);

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('returns SESSION_NOT_FOUND for ended session', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		await api.endSession(startResult.data.sessionId);

		const restoreResult = await api.restoreSession(startResult.data.sessionId);

		expect(restoreResult.success).toBe(false);
		if (restoreResult.success) return;

		expect(restoreResult.error.code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
	});

	describe('state preservation', () => {
		it('preserves current question progress after restore', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;

			// Answer first 2 questions
			for (let i = 0; i < 2; i++) {
				const correctBrandId = await getCorrectBrandId(sessionId, i);
				await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId));
			}

			// Restore session
			const restoreResult = await api.restoreSession(sessionId);
			expect(restoreResult.success).toBe(true);

			// Verify we can continue from question 2 (not question 0)
			const correctBrandId = await getCorrectBrandId(sessionId, 2);
			const answerResult = await api.submitAnswer(sessionId, createAnswerRequest(2, correctBrandId));

			expect(answerResult.success).toBe(true);
			if (!answerResult.success) return;

			expect(answerResult.data.isCorrect).toBe(true);
		});

		it('preserves score and lives after restore', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			// Get a correct answer (gains score)
			const correctResult = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));
			expect(correctResult.success).toBe(true);
			if (!correctResult.success) return;

			const scoreAfterCorrect = correctResult.data.score;

			// Get a wrong answer (loses life)
			const wrongResult = await api.submitAnswer(sessionId, createAnswerRequest(1, wrongBrandId));
			expect(wrongResult.success).toBe(true);
			if (!wrongResult.success) return;

			const livesAfterWrong = wrongResult.data.lives;

			await api.restoreSession(sessionId);

			const sessionState = await getSessionStateOrFail(sessionId);
			expect(sessionState.score).toBe(scoreAfterCorrect);
			expect(sessionState.lives).toBe(livesAfterWrong);
			expect(sessionState.currentQuestion).toBe(1);
		});
	});
});

describe('submitAnswer', () => {
	describe('validation', () => {
		it('returns INVALID_SESSION_ID for non-existent session', async () => {
			const fakeSessionId = '0000000000000000000000000000000000000000000000000000000000000000';
			const result = await getApi().submitAnswer(fakeSessionId, createAnswerRequest(0, 1));

			expect(result.success).toBe(false);
			if (result.success) return;

			expect(result.error.code).toBe(SessionErrorCode.INVALID_SESSION_ID);
		});

		it('returns INVALID_QUESTION_NUMBER for wrong question number', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const result = await api.submitAnswer(startResult.data.sessionId, createAnswerRequest(5, 1));

			expect(result.success).toBe(false);
			if (result.success) return;

			expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
		});

		it('returns INVALID_QUESTION_NUMBER for negative question number', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const result = await api.submitAnswer(startResult.data.sessionId, createAnswerRequest(-1, 1));

			expect(result.success).toBe(false);
			if (result.success) return;

			expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
		});

		it('returns INVALID_INPUT_FORMAT when brandId is missing', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const result = await api.submitAnswer(startResult.data.sessionId, {
				questionNumber: 0,
				brandId: undefined as unknown as number,
				timeTaken: null,
			});

			expect(result.success).toBe(false);
			if (result.success) return;

			expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
		});

		it('returns INVALID_INPUT_FORMAT when questionNumber is missing', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const result = await api.submitAnswer(startResult.data.sessionId, {
				questionNumber: undefined as unknown as number,
				brandId: 1,
				timeTaken: null,
			});

			expect(result.success).toBe(false);
			if (result.success) return;

			expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
		});
	});

	describe('correct answers', () => {
		it('accepts correct answer and returns isCorrect true', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId, 2500));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.isCorrect).toBe(true);
			expect(result.data.lives).toBe(3);
			expect(result.data.score).toBeGreaterThan(0);
			expect(result.data.logo).toBeTruthy();
		});

		it('advances to next question after correct answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));

			const sessionState = await getSessionStateOrFail(sessionId);
			expect(sessionState.currentQuestion).toBe(1);
		});

		it('increments score based on difficulty', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.score).toBeGreaterThan(0);
		});

		it('score increases with each correct answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			let previousScore = 0;

			for (let i = 0; i < 3; i++) {
				const correctBrandId = await getCorrectBrandId(sessionId, i);
				const result = await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId));

				expect(result.success).toBe(true);
				if (!result.success) return;

				expect(result.data.score).toBeGreaterThan(previousScore);
				previousScore = result.data.score;
			}
		});
	});

	describe('incorrect answers', () => {
		it('decrements lives on wrong answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.isCorrect).toBe(false);
			expect(result.data.lives).toBe(2);
		});

		it('does not advance question on wrong answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			const sessionState = await getSessionStateOrFail(sessionId);
			expect(sessionState.currentQuestion).toBe(0);
		});

		it('does not change score on wrong answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.score).toBe(0);
		});

		it('allows retry on same question after wrong answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			const retryResult = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));

			expect(retryResult.success).toBe(true);
			if (!retryResult.success) return;

			expect(retryResult.data.isCorrect).toBe(true);
		});
	});

	describe('game over', () => {
		it('returns GAME_OVER after losing all lives', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			// Lose all 3 lives
			for (let i = 0; i < 3; i++) {
				await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));
			}

			const gameOverResult = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			expect(gameOverResult.success).toBe(false);
			if (gameOverResult.success) return;

			expect(gameOverResult.error.code).toBe(SessionErrorCode.GAME_OVER);
		});

		it('returns lives as 0 on final wrong answer before game over', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			// Get to 1 life
			await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));
			await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			// Final wrong answer
			const finalResult = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			expect(finalResult.success).toBe(true);
			if (!finalResult.success) return;

			expect(finalResult.data.lives).toBe(0);
		});
	});

	describe('timeTaken handling', () => {
		it('accepts null timeTaken', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId, null));

			expect(result.success).toBe(true);
		});

		it('accepts zero timeTaken', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId, 0));

			expect(result.success).toBe(true);
		});
	});

	describe('response structure', () => {
		it('returns correct logo URL format on correct answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.logo).toMatch(/^http/);
			expect(result.data.logo).toContain('/brands/');
		});

		it('returns logo on wrong answer', async () => {
			const api = getApi();
			const startResult = await api.startSession();
			expect(startResult.success).toBe(true);
			if (!startResult.success) return;

			const sessionId = startResult.data.sessionId;
			const correctBrandId = await getCorrectBrandId(sessionId, 0);
			const wrongBrandId = correctBrandId + 99999;

			const result = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.logo).toBeTruthy();
			expect(typeof result.data.logo).toBe('string');
		});
	});
});

describe('endSession', () => {
	it('successfully ends an active session', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const result = await api.endSession(startResult.data.sessionId);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.message).toBe('Session ended and memory cleared');
	});

	it('clears session state after ending', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;

		await api.endSession(sessionId);

		const sessionState = await getSessionState(sessionId);
		expect(sessionState).toBeNull();
	});

	it('returns INVALID_SESSION_ID for malformed session id', async () => {
		const result = await getApi().endSession('invalid-session-id');

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('prevents submitting answers after session ended', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;

		await api.endSession(sessionId);

		const result = await api.submitAnswer(sessionId, createAnswerRequest(0, 1));

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
	});
});

describe('game completion', () => {
	it('clears session after answering all questions correctly', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;
		const totalQuestions = startResult.data.questions.length;

		// Answer all questions correctly
		for (let i = 0; i < totalQuestions; i++) {
			const correctBrandId = await getCorrectBrandId(sessionId, i);
			const result = await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId, 1000));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.isCorrect).toBe(true);
			expect(result.data.lives).toBe(3);
		}

		const sessionState = await getSessionState(sessionId);
		expect(sessionState).toBeNull();
	});

	it('returns final score with time bonus on last question', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;
		const totalQuestions = startResult.data.questions.length;

		let scoreBeforeLast = 0;

		// Answer all but last question
		for (let i = 0; i < totalQuestions - 1; i++) {
			const correctBrandId = await getCorrectBrandId(sessionId, i);
			const result = await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId, null));

			expect(result.success).toBe(true);
			if (!result.success) return;

			scoreBeforeLast = result.data.score;
		}

		// Answer last question with timeTaken for bonus
		const lastCorrectBrandId = await getCorrectBrandId(sessionId, totalQuestions - 1);
		const finalResult = await api.submitAnswer(sessionId, createAnswerRequest(totalQuestions - 1, lastCorrectBrandId, 100));

		expect(finalResult.success).toBe(true);
		if (!finalResult.success) return;

		expect(finalResult.data.score).toBeGreaterThan(scoreBeforeLast + 6);
	});

	it('cannot submit answers after game completion', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;
		const totalQuestions = startResult.data.questions.length;

		// Complete the game
		for (let i = 0; i < totalQuestions; i++) {
			const correctBrandId = await getCorrectBrandId(sessionId, i);
			await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId));
		}

		// Try to submit another answer
		const result = await api.submitAnswer(sessionId, createAnswerRequest(0, 1));

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
	});
});

describe('full game flow', () => {
	it('completes start → answer → restore → end lifecycle', async () => {
		const api = getApi();

		// Start
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;
		const correctBrandId = await getCorrectBrandId(sessionId, 0);

		// Answer
		const answerResult = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId, 3000));
		expect(answerResult.success).toBe(true);

		// Restore mid-game
		const restoreResult = await api.restoreSession(sessionId);
		expect(restoreResult.success).toBe(true);

		// End
		const endResult = await api.endSession(sessionId);
		expect(endResult.success).toBe(true);

		const restoreAfterEnd = await api.restoreSession(sessionId);
		expect(restoreAfterEnd.success).toBe(false);
	});

	it('maintains state correctly across multiple answers', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;

		// Answer first 3 questions correctly
		for (let i = 0; i < 3; i++) {
			const correctBrandId = await getCorrectBrandId(sessionId, i);
			const result = await api.submitAnswer(sessionId, createAnswerRequest(i, correctBrandId));

			expect(result.success).toBe(true);
			if (!result.success) return;

			expect(result.data.lives).toBe(3);
		}

		const sessionState = await getSessionStateOrFail(sessionId);
		expect(sessionState.currentQuestion).toBe(3);
		expect(sessionState.score).toBeGreaterThan(0);
	});

	it('handles mixed correct and incorrect answers', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;
		const correctBrandId = await getCorrectBrandId(sessionId, 0);
		const wrongBrandId = correctBrandId + 99999;

		// Wrong answer
		const wrongResult = await api.submitAnswer(sessionId, createAnswerRequest(0, wrongBrandId));
		expect(wrongResult.success).toBe(true);
		if (!wrongResult.success) return;
		expect(wrongResult.data.lives).toBe(2);

		// Correct answer (same question)
		const correctResult = await api.submitAnswer(sessionId, createAnswerRequest(0, correctBrandId));
		expect(correctResult.success).toBe(true);
		if (!correctResult.success) return;
		expect(correctResult.data.lives).toBe(2);

		const sessionState = await getSessionStateOrFail(sessionId);
		expect(sessionState.currentQuestion).toBe(1);
	});
});

describe('concurrent operations', () => {
	it('handles concurrent session starts', async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => getApi().startSession()));

		const successfulResults = results.filter((r) => r.success);
		expect(successfulResults).toHaveLength(5);

		const sessionIds = successfulResults.map((r) => (r.success ? r.data.sessionId : null));
		expect(new Set(sessionIds).size).toBe(5);
	});
});
