import { describe, it, expect } from 'vitest';

import {
	generateLogoUrl,
	generateLogoQuestions,
	calculateTimeTakenBonus,
	isValidAnswerSubmission,
	calculateLogoQuizScore,
} from '../../src/utils';
import type { Brand, StoredQuestion } from '../../src/types';

const MEDIA_BASE_URL = 'https://cdn.example.com';

const createBrand = (id: number, difficulty: number): Brand => ({
	id,
	brand_name: `Brand ${id}`,
	difficulty,
	media_id: `media-${id}`,
});

const createFullBrandSet = (): Brand[] => [
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 1, 1)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 11, 2)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 21, 3)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 31, 4)),
	...Array.from({ length: 10 }, (_, i) => createBrand(i + 41, 5)),
];

// -------------------- generateLogoQuestions --------------------
describe('generateLogoQuestions', () => {
	it('returns exactly 15 questions', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(createFullBrandSet(), MEDIA_BASE_URL);
		expect(questions).toHaveLength(15);
	});

	it('ensures all selected questions have unique brand IDs', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(createFullBrandSet(), MEDIA_BASE_URL);
		const brandIds = questions.map((q) => q.brandId);
		const uniqueBrandIds = new Set(brandIds);
		expect(uniqueBrandIds.size).toBe(questions.length);
	});

	it('ensures difficulty distribution follows the rules', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(createFullBrandSet(), MEDIA_BASE_URL);

		const difficultyCounts = questions.reduce(
			(acc, q) => {
				acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
				return acc;
			},
			{} as Record<number, number>,
		);

		expect((difficultyCounts[1] || 0) + (difficultyCounts[2] || 0)).toBe(9);
		expect(difficultyCounts[3]).toBe(3);
		expect(difficultyCounts[4]).toBe(2);
		expect(difficultyCounts[5]).toBe(1);
	});

	it('returns correct logo URLs for each brand', () => {
		const questions: StoredQuestion[] = generateLogoQuestions(createFullBrandSet(), MEDIA_BASE_URL);

		questions.forEach((q) => {
			const expectedUrl = generateLogoUrl(q.mediaId, true, MEDIA_BASE_URL);
			expect(q.logo).toBe(expectedUrl);
		});
	});

	it('returns empty array when brands array is empty', () => {
		const questions = generateLogoQuestions([], MEDIA_BASE_URL);
		expect(questions).toEqual([]);
	});

	it('returns empty array when not enough brands total', () => {
		const fewBrands: Brand[] = Array.from({ length: 5 }, (_, i) => createBrand(i + 1, 1));
		const questions = generateLogoQuestions(fewBrands, MEDIA_BASE_URL);
		expect(questions).toEqual([]);
	});

	it('returns empty array when missing required difficulty level', () => {
		// Missing difficulty 3 brands (need 3 of them)
		const incompleteBrands: Brand[] = [
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 1, 1)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 11, 2)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 31, 4)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 41, 5)),
		];
		const questions = generateLogoQuestions(incompleteBrands, MEDIA_BASE_URL);
		expect(questions).toEqual([]);
	});

	it('returns empty array when not enough easy brands', () => {
		// Only 5 easy brands (need 9)
		const fewEasyBrands: Brand[] = [
			...Array.from({ length: 5 }, (_, i) => createBrand(i + 1, 1)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 21, 3)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 31, 4)),
			...Array.from({ length: 10 }, (_, i) => createBrand(i + 41, 5)),
		];
		const questions = generateLogoQuestions(fewEasyBrands, MEDIA_BASE_URL);
		expect(questions).toEqual([]);
	});
});

// -------------------- generateLogoUrl --------------------
describe('generateLogoUrl', () => {
	const baseUrl = 'https://cdn.example.com';

	it('returns correct visible logo URL', () => {
		const url = generateLogoUrl('1c0ade56-1fee-5aae-b705-152fe6464e8f', false, baseUrl);
		expect(url).toBe('https://cdn.example.com/brands/1c0ade56-1fee-5aae-b705-152fe6464e8f/logo/logo.webp');
	});

	it('returns correct hidden logo URL', () => {
		const url = generateLogoUrl('1c0ade56-1fee-5aae-b705-152fe6464e8f', true, baseUrl);
		expect(url).toBe('https://cdn.example.com/brands/1c0ade56-1fee-5aae-b705-152fe6464e8f/logo/logo-hidden.webp');
	});

	it('handles empty mediaId', () => {
		const url = generateLogoUrl('', false, baseUrl);
		expect(url).toBe('https://cdn.example.com/brands//logo/logo.webp');
	});
});

// -------------------- calculateTimeTakenBonus --------------------
describe('calculateTimeTakenBonus', () => {
	it('returns no bonus for negative timeTaken', () => {
		expect(calculateTimeTakenBonus(-10)).toBe(0);
	});

	it('awards maximum bonus (55) for instant completion', () => {
		expect(calculateTimeTakenBonus(0)).toBe(55);
	});

	it('awards minimum bonus (1) at threshold (900 seconds)', () => {
		expect(calculateTimeTakenBonus(900)).toBe(1);
	});

	it('awards minimum bonus (1) beyond threshold', () => {
		expect(calculateTimeTakenBonus(1200)).toBe(1);
	});

	it('scales bonus linearly between 0 and threshold', () => {
		const midBonus = calculateTimeTakenBonus(450); // 7.5 minutes
		expect(midBonus).toBeGreaterThan(1);
		expect(midBonus).toBeLessThan(55);
		expect(midBonus).toBeCloseTo(27.5, 0);
	});
});

// -------------------- isValidAnswerSubmission --------------------
describe('isValidAnswerSubmission', () => {
	describe('valid submissions', () => {
		it('accepts valid submission with required fields', () => {
			expect(isValidAnswerSubmission({ questionNumber: 1, brandId: 5 })).toBe(true);
		});

		it('accepts valid submission with timeTaken', () => {
			expect(isValidAnswerSubmission({ questionNumber: 1, brandId: 5, timeTaken: 180 })).toBe(true);
		});

		it('accepts zero as valid questionNumber', () => {
			expect(isValidAnswerSubmission({ questionNumber: 0, brandId: 5 })).toBe(true);
		});

		it('accepts negative integers (semantic validation happens elsewhere)', () => {
			expect(isValidAnswerSubmission({ questionNumber: -1, brandId: 5 })).toBe(true);
		});
	});

	describe('invalid submissions', () => {
		it('rejects null', () => {
			expect(isValidAnswerSubmission(null)).toBe(false);
		});

		it('rejects undefined', () => {
			expect(isValidAnswerSubmission(undefined)).toBe(false);
		});

		it('rejects empty object', () => {
			expect(isValidAnswerSubmission({})).toBe(false);
		});

		it('rejects arrays', () => {
			expect(isValidAnswerSubmission([1, 2, 3])).toBe(false);
		});

		it('rejects submission missing questionNumber', () => {
			expect(isValidAnswerSubmission({ brandId: 5 })).toBe(false);
		});

		it('rejects submission missing brandId', () => {
			expect(isValidAnswerSubmission({ questionNumber: 1 })).toBe(false);
		});

		it('rejects string values', () => {
			expect(isValidAnswerSubmission({ questionNumber: '1', brandId: 5 })).toBe(false);
		});

		it('rejects float values', () => {
			expect(isValidAnswerSubmission({ questionNumber: 1.5, brandId: 5 })).toBe(false);
		});
	});
});

// -------------------- calculateLogoQuizScore --------------------
describe('calculateLogoQuizScore', () => {
	describe('easy difficulties (≤2) return 1 point', () => {
		it('returns 1 for difficulty 0', () => {
			expect(calculateLogoQuizScore(0)).toBe(1);
		});

		it('returns 1 for difficulty 1', () => {
			expect(calculateLogoQuizScore(1)).toBe(1);
		});

		it('returns 1 for difficulty 2', () => {
			expect(calculateLogoQuizScore(2)).toBe(1);
		});

		it('returns 1 for negative difficulty', () => {
			expect(calculateLogoQuizScore(-1)).toBe(1);
		});
	});

	describe('hard difficulties (≥3) return difficulty value', () => {
		it('returns 3 for difficulty 3', () => {
			expect(calculateLogoQuizScore(3)).toBe(3);
		});

		it('returns 4 for difficulty 4', () => {
			expect(calculateLogoQuizScore(4)).toBe(4);
		});

		it('returns 5 for difficulty 5', () => {
			expect(calculateLogoQuizScore(5)).toBe(5);
		});
	});
});
