import { describe, it, expect } from 'vitest';

import { getApi, createAnswerRequest, getCorrectBrandId, getSessionStateOrFail } from './../testHelper';

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
