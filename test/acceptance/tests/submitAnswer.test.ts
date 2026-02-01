import { describe, it, expect } from 'vitest';

import { getApi, createAnswerRequest, getCorrectBrandId, getSessionStateOrFail } from './../testHelper';
import { SessionErrorCode } from '../../../src/types';

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
