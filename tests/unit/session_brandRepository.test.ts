import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBrands } from '../../src/repositories/brandRepository';
import type { Brand, Env } from '../../src/types';

const sessionId = 'test-session';

// Sample brands for testing
const mockBrands: Brand[] = [
	{ id: 1, brand_name: 'Brand A', difficulty: 2, media_id: 'media-1' },
	{ id: 2, brand_name: 'Brand B', difficulty: 3, media_id: 'media-2' },
];

// Properly mocked Cloudflare KV and D1 DB
const mockEnv: Env = {
	MEDIA_BASE_URL: 'https://cdn.example.com',
	PRODUCTION: false,
	BRANDS_CACHE_DURATION: '600',
	BRANDS_KV: {
		get: vi.fn(),
		put: vi.fn(),
	} as any,
	DB: {
		prepare: vi.fn(),
	} as any,
	SESSION_DO: {} as any,
};

describe('fetchBrands', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns cached brands if available', async () => {
		(mockEnv.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(mockBrands));

		const brands = await fetchBrands(mockEnv, sessionId);

		expect(mockEnv.BRANDS_KV.get).toHaveBeenCalledWith('brands', 'json');
		expect(mockEnv.DB.prepare).not.toHaveBeenCalled();
		expect(brands).toEqual(mockBrands);
	});

	it('fetches from the database if cache is empty', async () => {
		(mockEnv.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(mockEnv.DB.prepare as any).mockReturnValue({
			all: vi.fn().mockResolvedValue({ results: mockBrands }),
		});

		const brands = await fetchBrands(mockEnv, sessionId);

		expect(mockEnv.BRANDS_KV.get).toHaveBeenCalledWith('brands', 'json');
		expect(mockEnv.DB.prepare).toHaveBeenCalledWith('SELECT id, brand_name, difficulty, media_id FROM brands;');
		expect(brands).toEqual(mockBrands);
	});

	it('stores data in cache after DB fetch', async () => {
		(mockEnv.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(mockEnv.DB.prepare as any).mockReturnValue({
			all: vi.fn().mockResolvedValue({ results: mockBrands }),
		});

		await fetchBrands(mockEnv, sessionId);

		expect(mockEnv.BRANDS_KV.put).toHaveBeenCalledWith('brands', JSON.stringify(mockBrands), { expirationTtl: 600 });
	});

	it('returns an empty array if DB query fails', async () => {
		(mockEnv.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(mockEnv.DB.prepare as any).mockReturnValue({
			all: vi.fn().mockRejectedValue(new Error('DB connection failed')),
		});

		const brands = await fetchBrands(mockEnv, sessionId);

		expect(mockEnv.DB.prepare).toHaveBeenCalled();
		expect(brands).toEqual([]);
	});
});
