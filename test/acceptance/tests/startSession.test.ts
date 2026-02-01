import { describe, it, expect } from 'vitest';

import { EXPECTED_BRAND_COUNT, EXPECTED_QUESTION_COUNT, getApi, getSessionStateOrFail } from '../testHelper';

describe('startSession', () => {
	it('returns session with brands and questions', async () => {
		const result = await getApi().startSession();

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.sessionId).toBeTruthy();
		expect(typeof result.data.sessionId).toBe('string');
		expect(result.data.brands).toHaveLength(EXPECTED_BRAND_COUNT);
		expect(result.data.questions).toHaveLength(EXPECTED_QUESTION_COUNT);
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
		expect(sessionState.questions).toHaveLength(EXPECTED_QUESTION_COUNT);
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
