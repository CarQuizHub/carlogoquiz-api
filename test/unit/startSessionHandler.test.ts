import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleStartSession } from '../../src/handlers/startSessionHandler';
import { fetchBrands } from '../../src/repositories/brandRepository';
import * as LogoUtils from '../../src/utils/logoUtils';
import type { StoredQuestion, Brand, Bindings } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

vi.mock('../../src/repositories/brandRepository', () => ({ fetchBrands: vi.fn() }));
vi.mock('../../src/utils/logoUtils', () => ({ generateLogoQuestions: vi.fn() }));

const DO_ID = 'do-id-123';

describe('handleStartSession', () => {
	let fakeSession: {
		sessionData: any;
		state: { id: { toString: () => string } };
		save: ReturnType<typeof vi.fn>;
	};
	let fakeEnv: Bindings;
	let mockBrands: Brand[];
	let mockQuestions: StoredQuestion[];

	beforeEach(() => {
		vi.clearAllMocks();

		mockBrands = [
			{ id: 1, brand_name: 'Brand A', difficulty: 2, media_id: 'media1' },
			{ id: 2, brand_name: 'Brand B', difficulty: 3, media_id: 'media2' },
		];

		mockQuestions = [
			{ logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
			{ logo: 'logo2.png', brandId: 2, difficulty: 3, mediaId: 'media2' },
		];

		fakeEnv = {
			MEDIA_BASE_URL: 'https://cdn.example.com',
			PRODUCTION: false,
			BRANDS_CACHE_DURATION: '600',
			BRANDS_KV: {} as any,
			DB: {} as any,
			SESSION: {} as any,
		} as Bindings;

		fakeSession = {
			sessionData: null,
			state: { id: { toString: () => DO_ID } },
			save: vi.fn().mockResolvedValue(undefined),
		};
	});

	it('starts a new session successfully', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.brands).toEqual([
				{ id: 1, brand_name: 'Brand A' },
				{ id: 2, brand_name: 'Brand B' },
			]);
			expect(result.data.questions).toEqual([{ question: { logo: 'logo1.png' } }, { question: { logo: 'logo2.png' } }]);
		}

		expect(fakeSession.sessionData).toEqual({
			score: 0,
			lives: 3,
			currentQuestion: 0,
			questions: mockQuestions,
		});

		expect(fakeSession.save).toHaveBeenCalledTimes(1);
		expect(fetchBrands).toHaveBeenCalledWith(fakeEnv, DO_ID);
		expect(LogoUtils.generateLogoQuestions).toHaveBeenCalledWith(mockBrands, fakeEnv.MEDIA_BASE_URL);
	});

	it('overwrites existing sessionData on new start', async () => {
		fakeSession.sessionData = {
			score: 999,
			lives: 1,
			currentQuestion: 7,
			questions: [{ logo: 'old.png', brandId: 99, difficulty: 9, mediaId: 'old' }],
		};

		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(true);
		expect(fakeSession.sessionData.score).toBe(0);
		expect(fakeSession.sessionData.lives).toBe(3);
		expect(fakeSession.sessionData.currentQuestion).toBe(0);
		expect(fakeSession.sessionData.questions).toEqual(mockQuestions);
	});

	it('returns NO_BRANDS_AVAILABLE when fetchBrands returns empty array', async () => {
		(fetchBrands as any).mockResolvedValue([]);

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.NO_BRANDS_AVAILABLE);
			expect(result.error.message).toBe('No brands available');
		}

		expect(LogoUtils.generateLogoQuestions).not.toHaveBeenCalled();
		expect(fakeSession.save).not.toHaveBeenCalled();
	});

	it('returns NO_QUESTIONS_AVAILABLE when generateLogoQuestions returns empty array', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue([]);

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.NO_QUESTIONS_AVAILABLE);
			expect(result.error.message).toBe('No questions available');
		}

		expect(fakeSession.save).not.toHaveBeenCalled();
	});

	it('returns INTERNAL_ERROR when fetchBrands throws', async () => {
		(fetchBrands as any).mockRejectedValue(new Error('Database failure'));

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to start session');
		}
	});

	it('returns INTERNAL_ERROR when save() throws', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);
		fakeSession.save.mockRejectedValue(new Error('Storage failure'));

		const result = await handleStartSession(fakeSession as any, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to start session');
		}
	});
});
