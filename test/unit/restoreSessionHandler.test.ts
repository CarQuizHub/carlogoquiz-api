import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleRestoreSession } from '../../src/handlers/restoreSessionHandler';
import { fetchBrands } from '../../src/repositories/brandRepository';
import type { SessionContext } from '../../src/types/session';
import type { Bindings, Brand, StoredQuestion } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

vi.mock('../../src/repositories/brandRepository', () => ({ fetchBrands: vi.fn() }));

const DO_ID = 'do-id-restore-123';

describe('handleRestoreSession', () => {
	let fakeSession: SessionContext;
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
			sessionId: DO_ID,
			sessionData: null,
			save: vi.fn().mockResolvedValue(undefined),
			clear: vi.fn().mockResolvedValue(undefined),
		};
	});

	it('restores existing session and returns brands + questions', async () => {
		fakeSession.sessionData = {
			score: 10,
			lives: 2,
			currentQuestion: 1,
			questions: mockQuestions,
		};

		(fetchBrands as any).mockResolvedValue(mockBrands);

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.brands).toEqual([
				{ id: 1, brand_name: 'Brand A' },
				{ id: 2, brand_name: 'Brand B' },
			]);
			expect(result.data.questions).toEqual([{ question: { logo: 'logo1.png' } }, { question: { logo: 'logo2.png' } }]);
		}

		expect(fetchBrands).toHaveBeenCalledWith(fakeEnv, DO_ID);
	});

	it('returns SESSION_NOT_FOUND when sessionData is null', async () => {
		fakeSession.sessionData = null;

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
			expect(result.error.message).toBe('Session not found or expired');
		}

		expect(fetchBrands).not.toHaveBeenCalled();
	});

	it('returns SESSION_NOT_FOUND when questions array is empty', async () => {
		fakeSession.sessionData = {
			score: 0,
			lives: 3,
			currentQuestion: 0,
			questions: [],
		};

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
			expect(result.error.message).toBe('Session not found or expired');
		}

		expect(fetchBrands).not.toHaveBeenCalled();
	});

	it('returns INTERNAL_ERROR when fetchBrands throws', async () => {
		fakeSession.sessionData = {
			score: 0,
			lives: 3,
			currentQuestion: 0,
			questions: mockQuestions,
		};

		(fetchBrands as any).mockRejectedValue(new Error('Database failure'));

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to restore session');
		}
	});
});
