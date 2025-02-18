import { describe, it, expect } from 'vitest';
import {
	GenerateLogoUrl,
	generateLogoQuestions,
	CalculateTimeTakenBonus,
	isValidAnswerSubmission,
	calculateLogoQuizScore,
} from '../../src/services/session/utils';
import type { Brand, StoredQuestion, Env } from '../../src/types';

const mockEnv: Env = {
	MEDIA_BASE_URL: 'https://cdn.example.com',
	PRODUCTION: false,
	BRANDS_CACHE_DURATION: '10',
	DB: {} as any,
	BRANDS_KV: {} as any,
	SESSION_DO: {} as any,
};

const createBrand = (id: number, difficulty: number): Brand => ({
	id,
	brand_name: `Brand ${id}`,
	difficulty,
	media_id: `media-${id}`,
});

const brands: Brand[] = [
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 1, 1)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 11, 2)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 21, 3)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 31, 4)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 41, 5)),
];

describe('generateLogoQuestions', () => {
	it('returns exactly 15 questions', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(brands, mockEnv);

		expect(questions).toHaveLength(15);
	});

	it('ensures all selected questions have unique brand IDs', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(brands, mockEnv);
		const brandIds = questions.map((q) => q.brandId);
		const uniqueBrandIds = new Set(brandIds);

		expect(uniqueBrandIds.size).toBe(questions.length);
	});

	it('ensures difficulty distribution follows the rules', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(brands, mockEnv);

		const difficultyCounts = questions.reduce(
			(acc, q) => {
				acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
				return acc;
			},
			{} as Record<number, number>,
		);

		expect(difficultyCounts[1] + difficultyCounts[2]).toBe(9);
		expect(difficultyCounts[3]).toBe(3);
		expect(difficultyCounts[4]).toBe(2);
		expect(difficultyCounts[5]).toBe(1);
	});

	it('returns correct logo URLs for each brand', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(brands, mockEnv);

		questions.forEach((q) => {
			const expectedUrl = GenerateLogoUrl(q.mediaId, true, mockEnv.MEDIA_BASE_URL);
			expect(q.logo).toBe(expectedUrl);
		});
	});

	it('handles cases where there are not enough brands', () => {
		const brands: Brand[] = [...Array.from({ length: 5 }, (_, i) => createBrand(i + 1, 1))];

		const questions: StoredQuestion[] = generateLogoQuestions(brands, mockEnv);

		expect(questions).toHaveLength(5);
		expect(new Set(questions.map((q) => q.brandId)).size).toBe(5);
	});

	it('handles an empty input array gracefully', () => {
		const questions: StoredQuestion[] = generateLogoQuestions([], mockEnv);

		expect(questions).toHaveLength(0);
	});
});

describe('GenerateLogoUrl', () => {
	const baseUrl = 'https://cdn.example.com';

	it('returns correct visible logo URL', () => {
		const url = GenerateLogoUrl('1c0ade56-1fee-5aae-b705-152fe6464e8f', false, baseUrl);
		expect(url).toBe('https://cdn.example.com/brands/1c0ade56-1fee-5aae-b705-152fe6464e8f/logo.webp');
	});

	it('returns correct hidden logo URL', () => {
		const url = GenerateLogoUrl('1c0ade56-1fee-5aae-b705-152fe6464e8f', true, baseUrl);
		expect(url).toBe('https://cdn.example.com/brands/1c0ade56-1fee-5aae-b705-152fe6464e8f/logo-hidden.webp');
	});
});

describe('CalculateTimeTakenBonus', () => {
	it('awards maximum bonus (55) for fastest completion', () => {
		expect(CalculateTimeTakenBonus(0)).toBe(55);
	});

	it('awards minimum bonus (1) for very slow completion', () => {
		expect(CalculateTimeTakenBonus(300)).toBe(1);
	});

	it('scales bonus correctly over time', () => {
		expect(CalculateTimeTakenBonus(90)).toBeGreaterThan(1);
		expect(CalculateTimeTakenBonus(90)).toBeLessThan(55);
	});
});

describe('isValidAnswerSubmission', () => {
	it('accepts a valid submission', () => {
		expect(isValidAnswerSubmission({ questionNumber: 1, brandId: 5 })).toBe(true);
	});

	it('accepts a valid submission with time taken', () => {
		expect(isValidAnswerSubmission({ questionNumber: 1, brandId: 5, timeTaken: 180 })).toBe(true);
	});

	it('rejects submission missing questionNumber', () => {
		expect(isValidAnswerSubmission({ brandId: 5 })).toBe(false);
	});

	it('rejects submission missing brandId', () => {
		expect(isValidAnswerSubmission({ questionNumber: 1 })).toBe(false);
	});

	it('rejects non-integer values', () => {
		expect(isValidAnswerSubmission({ questionNumber: '1', brandId: 5 })).toBe(false);
	});
});

describe('calculateLogoQuizScore', () => {
	it('returns 1 for difficulty ≤ 2', () => {
		expect(calculateLogoQuizScore(1)).toBe(1);
		expect(calculateLogoQuizScore(2)).toBe(1);
	});

	it('returns the difficulty value for difficulty ≥ 3', () => {
		expect(calculateLogoQuizScore(3)).toBe(3);
		expect(calculateLogoQuizScore(5)).toBe(5);
	});
});
