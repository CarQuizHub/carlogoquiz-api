import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleStartSession } from '../../src/handlers/startSessionHandler';
import { fetchBrands } from '../../src/repositories/brandRepository';
import * as LogoUtils from '../../src/utils/logoUtils';
import type { StoredQuestion, SessionData, Brand, Bindings } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

vi.mock('../../src/repositories/brandRepository', () => ({ fetchBrands: vi.fn() }));
vi.mock('../../src/utils/logoUtils', () => ({ generateLogoQuestions: vi.fn() }));

const DO_ID = 'do-id-123';

describe('handleStartSession', () => {
	let fakeSession: any;
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
			BRANDS_KV: { get: vi.fn(), put: vi.fn() } as any,
			DB: { prepare: vi.fn() } as any,
			SESSION: {} as any,
		} as any;

		fakeSession = {
			sessionData: null,
			state: {
				id: { toString: () => DO_ID },
				storage: { put: vi.fn().mockResolvedValue(undefined) },
			},
		};
	});

	it('starts a new session successfully', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.brands).toEqual(mockBrands.map(({ id, brand_name }) => ({ id, brand_name })));
			expect(result.data.questions).toEqual(mockQuestions.map(({ logo }) => ({ question: { logo } })));
		}

		expect(fakeSession.sessionData).not.toBeNull();
		expect(fakeSession.state.storage.put).toHaveBeenCalledWith('state', expect.objectContaining({ questions: expect.any(Object) }));

		expect(fetchBrands).toHaveBeenCalledWith(fakeEnv, DO_ID);
		expect(LogoUtils.generateLogoQuestions).toHaveBeenCalledWith(mockBrands, fakeEnv.MEDIA_BASE_URL);
	});

	it('overwrites existing sessionData (start is always new now)', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);

		// existing session data should get replaced
		fakeSession.sessionData = {
			score: 999,
			lives: 1,
			currentQuestion: 7,
			questions: {
				0: { logo: 'old.png', brandId: 99, difficulty: 9, mediaId: 'oldmedia' },
			},
		} as SessionData;

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(true);

		// Must regenerate + persist
		expect(LogoUtils.generateLogoQuestions).toHaveBeenCalledTimes(1);
		expect(fakeSession.state.storage.put).toHaveBeenCalledTimes(1);

		// New session defaults
		expect(fakeSession.sessionData.score).toBe(0);
		expect(fakeSession.sessionData.lives).toBe(3);
		expect(fakeSession.sessionData.currentQuestion).toBe(0);
		expect(Object.keys(fakeSession.sessionData.questions)).toHaveLength(mockQuestions.length);
	});

	it('returns an error when no brands are available', async () => {
		(fetchBrands as any).mockResolvedValue([]);

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.NO_BRANDS_AVAILABLE);
			expect(result.error.message).toBe('No brands available');
		}

		expect(LogoUtils.generateLogoQuestions).not.toHaveBeenCalled();
		expect(fakeSession.state.storage.put).not.toHaveBeenCalled();
	});

	it('returns an error when no questions are generated', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue([]);

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.NO_QUESTIONS_AVAILABLE);
			expect(result.error.message).toBe('No questions available');
		}

		expect(fakeSession.state.storage.put).not.toHaveBeenCalled();
	});

	it('returns INTERNAL_ERROR when storage.put fails', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);
		fakeSession.state.storage.put.mockRejectedValueOnce(new Error('storage failure'));

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to start session');
		}
	});

	it('handles unexpected errors gracefully (fetchBrands throws)', async () => {
		(fetchBrands as any).mockRejectedValue(new Error('Database failure'));

		const result = await handleStartSession(fakeSession, fakeEnv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to start session');
		}
	});
});
