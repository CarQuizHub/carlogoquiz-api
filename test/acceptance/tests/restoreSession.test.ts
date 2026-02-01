import { describe, it, expect } from 'vitest';

import { getApi, EXPECTED_BRAND_COUNT, createAnswerRequest, getCorrectBrandId, getSessionStateOrFail } from '../testHelper';
import { SessionErrorCode } from '../../../src/types';

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
		expect(restoreResult.data.brands).toHaveLength(EXPECTED_BRAND_COUNT);
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
