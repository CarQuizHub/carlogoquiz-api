import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRestoreSession } from '../../src/handlers/restoreSessionHandler';
import { fetchBrands } from '../../src/repositories/brandRepository';
import type { Bindings, Brand, SessionData } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

vi.mock('../../src/repositories/brandRepository', () => ({ fetchBrands: vi.fn() }));

const DO_ID = 'do-id-restore-123';

describe('handleRestoreSession', () => {
	let fakeSession: any;
	let fakeEnv: Bindings;
	let mockBrands: Brand[];

	beforeEach(() => {
		vi.clearAllMocks();

		mockBrands = [
			{ id: 1, brand_name: 'Brand A', difficulty: 2, media_id: 'media1' },
			{ id: 2, brand_name: 'Brand B', difficulty: 3, media_id: 'media2' },
		];

		fakeEnv = {
			MEDIA_BASE_URL: 'https://cdn.example.com',
			PRODUCTION: false,
			BRANDS_CACHE_DURATION: '600',
			BRANDS_KV: { get: vi.fn(), put: vi.fn() } as any,
			DB: { prepare: vi.fn() } as any,
			SESSION: {} as any,
		} as any;

		fakeSession = {
			sessionData: null as SessionData | null,
			state: {
				id: { toString: () => DO_ID },
				storage: {
					put: vi.fn().mockResolvedValue(undefined),
					deleteAll: vi.fn().mockResolvedValue(undefined),
				},
			},
		};
	});

	it('restores an existing session and returns brands + questions', async () => {
		fakeSession.sessionData = {
			score: 10,
			lives: 3,
			currentQuestion: 1,
			questions: {
				0: { logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
				1: { logo: 'logo2.png', brandId: 2, difficulty: 3, mediaId: 'media2' },
			},
		} as SessionData;

		(fetchBrands as any).mockResolvedValue(mockBrands);

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.brands).toEqual(mockBrands.map(({ id, brand_name }) => ({ id, brand_name })));
			expect(result.data.questions).toEqual([{ question: { logo: 'logo1.png' } }, { question: { logo: 'logo2.png' } }]);
		}

		expect(fakeSession.state.storage.put).not.toHaveBeenCalled();
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

	it('returns SESSION_NOT_FOUND when sessionData exists but has no questions', async () => {
		fakeSession.sessionData = {
			score: 0,
			lives: 3,
			currentQuestion: 0,
			questions: {},
		} as SessionData;

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
			questions: {
				0: { logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
			},
		} as SessionData;

		(fetchBrands as any).mockRejectedValue(new Error('DB failure'));

		const result = await handleRestoreSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to restore session');
		}
	});
});
