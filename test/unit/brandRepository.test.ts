import { describe, it, expect, vi, beforeEach } from 'vitest';

import { fetchBrands } from '../../src/repositories/brandRepository';
import type { Brand, Bindings } from '../../src/types';

const SESSION_ID = 'test-session';

const MOCK_BRANDS: Brand[] = [
	{ id: 1, brand_name: 'Brand A', difficulty: 2, media_id: 'media-1' },
	{ id: 2, brand_name: 'Brand B', difficulty: 3, media_id: 'media-2' },
];

describe('fetchBrands', () => {
	let mockEnv: Bindings;
	let kvGet: ReturnType<typeof vi.fn>;
	let kvPut: ReturnType<typeof vi.fn>;
	let dbPrepare: ReturnType<typeof vi.fn>;
	let dbAll: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();

		kvGet = vi.fn().mockResolvedValue(null);
		kvPut = vi.fn().mockResolvedValue(undefined);
		dbAll = vi.fn().mockResolvedValue({ results: MOCK_BRANDS });
		dbPrepare = vi.fn().mockReturnValue({ all: dbAll });

		mockEnv = {
			MEDIA_BASE_URL: 'https://cdn.example.com',
			PRODUCTION: false,
			BRANDS_CACHE_DURATION: '600',
			BRANDS_KV: { get: kvGet, put: kvPut } as any,
			DB: { prepare: dbPrepare } as any,
			SESSION: {} as any,
			EXPOSE_HTTP: false,
		};
	});

	describe('cache behavior', () => {
		it('returns cached brands when available', async () => {
			kvGet.mockResolvedValue(MOCK_BRANDS);

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(kvGet).toHaveBeenCalledWith('brands', 'json');
			expect(dbPrepare).not.toHaveBeenCalled();
			expect(brands).toEqual(MOCK_BRANDS);
		});

		it('fetches from database when cache is empty', async () => {
			kvGet.mockResolvedValue(null);

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(kvGet).toHaveBeenCalledWith('brands', 'json');
			expect(dbPrepare).toHaveBeenCalledWith('SELECT id, brand_name, difficulty, media_id FROM brands;');
			expect(brands).toEqual(MOCK_BRANDS);
		});

		it('stores data in cache after database fetch', async () => {
			kvGet.mockResolvedValue(null);

			await fetchBrands(mockEnv, SESSION_ID);

			expect(kvPut).toHaveBeenCalledWith('brands', JSON.stringify(MOCK_BRANDS), { expirationTtl: 600 });
		});

		it('uses configured cache duration', async () => {
			mockEnv.BRANDS_CACHE_DURATION = '3600';
			kvGet.mockResolvedValue(null);

			await fetchBrands(mockEnv, SESSION_ID);

			expect(kvPut).toHaveBeenCalledWith('brands', JSON.stringify(MOCK_BRANDS), { expirationTtl: 3600 });
		});

		it('uses default cache duration (1 week) when not configured', async () => {
			mockEnv.BRANDS_CACHE_DURATION = '';
			kvGet.mockResolvedValue(null);

			await fetchBrands(mockEnv, SESSION_ID);

			expect(kvPut).toHaveBeenCalledWith('brands', JSON.stringify(MOCK_BRANDS), { expirationTtl: 604800 });
		});

		it('uses default cache duration when value is invalid', async () => {
			mockEnv.BRANDS_CACHE_DURATION = 'invalid';
			kvGet.mockResolvedValue(null);

			await fetchBrands(mockEnv, SESSION_ID);

			expect(kvPut).toHaveBeenCalledWith('brands', JSON.stringify(MOCK_BRANDS), { expirationTtl: 604800 });
		});
	});

	describe('database behavior', () => {
		it('returns empty array from database', async () => {
			kvGet.mockResolvedValue(null);
			dbAll.mockResolvedValue({ results: [] });

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(brands).toEqual([]);
			expect(kvPut).toHaveBeenCalledWith('brands', '[]', { expirationTtl: 600 });
		});
	});

	describe('error handling', () => {
		it('returns empty array when KV.get throws', async () => {
			kvGet.mockRejectedValue(new Error('KV read failed'));

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(brands).toEqual([]);
			expect(dbPrepare).not.toHaveBeenCalled();
		});

		it('returns empty array when DB.prepare throws', async () => {
			kvGet.mockResolvedValue(null);
			dbPrepare.mockImplementation(() => {
				throw new Error('DB connection failed');
			});

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(brands).toEqual([]);
		});

		it('returns empty array when DB.all throws', async () => {
			kvGet.mockResolvedValue(null);
			dbAll.mockRejectedValue(new Error('Query failed'));

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			expect(brands).toEqual([]);
		});

		it('returns brands even when KV.put fails', async () => {
			kvGet.mockResolvedValue(null);
			kvPut.mockRejectedValue(new Error('KV write failed'));

			const brands = await fetchBrands(mockEnv, SESSION_ID);

			// Should still return brands despite cache write failure
			expect(brands).toEqual(MOCK_BRANDS);
		});
	});
});
