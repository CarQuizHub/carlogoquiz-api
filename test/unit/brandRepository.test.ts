import { describe, it, expect, vi } from 'vitest';
import { fetchBrands } from '../../src/repositories/brandRepository';
import type { Brand, Bindings } from '../../src/types';
import { D1Database } from '@cloudflare/workers-types';

const SESSION_ID = 'test-session';
const MOCK_BRANDS: Brand[] = [
	{ id: 1, brand_name: 'Brand A', difficulty: 2, media_id: 'media-1' },
	{ id: 2, brand_name: 'Brand B', difficulty: 3, media_id: 'media-2' },
];
const MOCK_ENV: Bindings = {
	MEDIA_BASE_URL: 'https://cdn.example.com',
	PRODUCTION: false,
	BRANDS_CACHE_DURATION: '600',
	BRANDS_KV: {
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined),
	} as any,
	DB: {
		prepare: vi.fn(),
	} as unknown as D1Database,
	SESSION_DO: {} as any,
};

describe('fetchBrands', () => {
	it('returns cached brands if available', async () => {
		(MOCK_ENV.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(MOCK_BRANDS));

		const brands = await fetchBrands(MOCK_ENV, SESSION_ID);

		expect(MOCK_ENV.BRANDS_KV.get).toHaveBeenCalledWith('brands', 'json');
		expect(MOCK_ENV.DB.prepare).not.toHaveBeenCalled();
		expect(brands).toEqual(MOCK_BRANDS);
	});

	it('fetches from the database if cache is empty', async () => {
		(MOCK_ENV.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(MOCK_ENV.DB.prepare as any).mockReturnValue({
			all: vi.fn().mockResolvedValue({ results: MOCK_BRANDS }),
		});

		const brands = await fetchBrands(MOCK_ENV, SESSION_ID);

		expect(MOCK_ENV.BRANDS_KV.get).toHaveBeenCalledWith('brands', 'json');
		expect(MOCK_ENV.DB.prepare).toHaveBeenCalledWith('SELECT id, brand_name, difficulty, media_id FROM brands;');
		expect(brands).toEqual(MOCK_BRANDS);
	});

	it('stores data in cache after DB fetch', async () => {
		(MOCK_ENV.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(MOCK_ENV.DB.prepare as any).mockReturnValue({
			all: vi.fn().mockResolvedValue({ results: MOCK_BRANDS }),
		});

		await fetchBrands(MOCK_ENV, SESSION_ID);

		expect(MOCK_ENV.BRANDS_KV.put).toHaveBeenCalledWith('brands', JSON.stringify(MOCK_BRANDS), { expirationTtl: 600 });
	});

	it('returns an empty array if DB query fails', async () => {
		(MOCK_ENV.BRANDS_KV.get as any).mockImplementation(() => Promise.resolve(null));

		(MOCK_ENV.DB.prepare as any).mockImplementation(() => {
			throw new Error('DB connection failed');
		});

		const brands = await fetchBrands(MOCK_ENV, SESSION_ID);

		expect(MOCK_ENV.DB.prepare).toHaveBeenCalled();
		expect(brands).toEqual([]);
	});
});
