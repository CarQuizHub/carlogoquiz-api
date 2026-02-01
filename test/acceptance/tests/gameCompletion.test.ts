import { describe, it, expect } from 'vitest';

import { getApi, createAnswerRequest, getCorrectBrandId, getSessionState } from './../testHelper';
import { SessionErrorCode } from '../../../src/types';

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
