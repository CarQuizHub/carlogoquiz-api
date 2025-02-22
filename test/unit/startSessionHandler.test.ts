import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStartSession } from '../../src/handlers/startSessionHandler';
import { fetchBrands } from '../../src/repositories/brandRepository';
import * as LogoUtils from '../../src/utils/logoUtils';
import type { StoredQuestion, SessionData, Brand, Bindings, ApiStartSessionResponse } from '../../src/types';

vi.mock('../../src/repositories/brandRepository', () => ({ fetchBrands: vi.fn() }));
vi.mock('../../src/utils/logoUtils', () => ({ generateLogoQuestions: vi.fn() }));

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
			BRANDS_KV: {
				get: vi.fn(),
				put: vi.fn(),
			} as any,
			DB: {
				prepare: vi.fn(() => ({ all: vi.fn().mockResolvedValue({ results: mockBrands }) })),
			} as any,
			SESSION: {} as any,
		};

		fakeSession = {
			sessionId: 'test-session',
			sessionData: null,
			state: { storage: { put: vi.fn().mockResolvedValue(undefined) } },
		} as any;
	});

	const testStartSession = async (expectedStatus: number, expectedData: any) => {
		const response = await handleStartSession(fakeSession, fakeEnv);
		const data = await response.json();
		expect(response.status).toBe(expectedStatus);
		expect(data).toEqual(expectedData);
	};

	it('starts a new session successfully', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue(mockQuestions);

		await testStartSession(200, {
			brands: mockBrands.map(({ id, brand_name }) => ({ id, brand_name })),
			questions: mockQuestions.map(({ logo }) => ({ question: { logo } })),
		});

		expect(fakeSession.state.storage.put).toHaveBeenCalledWith(
			`session-${fakeSession.sessionId}`,
			expect.objectContaining({ questions: expect.any(Object) }),
		);
	});

	it('restores session when session data exists', async () => {
		fakeSession.sessionData = {
			score: 0,
			lives: 3,
			currentQuestion: 0,
			questions: {
				0: { logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
			},
		} as SessionData;

		(fetchBrands as any).mockResolvedValue(mockBrands);

		await testStartSession(200, {
			brands: mockBrands.map(({ id, brand_name }) => ({ id, brand_name })),
			questions: [{ question: { logo: 'logo1.png' } }],
		});
	});

	it('returns an error when no brands are available', async () => {
		(fetchBrands as any).mockResolvedValue([]);
		await testStartSession(400, { error: 'No brands available' });
	});

	it('returns an error when no questions are generated', async () => {
		(fetchBrands as any).mockResolvedValue(mockBrands);
		(LogoUtils.generateLogoQuestions as any).mockReturnValue([]);
		await testStartSession(400, { error: 'No questions available' });
	});

	it('handles unexpected errors gracefully', async () => {
		(fetchBrands as any).mockRejectedValue(new Error('Database failure'));
		await testStartSession(500, { error: 'Error: Failed to start session' });
	});
});
