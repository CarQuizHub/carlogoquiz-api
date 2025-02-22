import { Bindings, Brand } from '../types';
import { logInfo, logError } from '../utils';

export async function fetchBrands(env: Bindings, sessionId: string): Promise<Brand[]> {
	const cacheKey = 'brands';
	const cacheDuration = parseInt(env.BRANDS_CACHE_DURATION) || 604800; // Default to 1 week if not set

	try {
		const cachedData = await env.BRANDS_KV.get<Brand[]>(cacheKey, 'json');
		if (cachedData) {
			logInfo('fetch_brands_cache_hit', sessionId, { brandCount: cachedData.length });
			return cachedData as Brand[];
		}

		const brandsQuery = 'SELECT id, brand_name, difficulty, media_id FROM brands;';
		const { results: brands }: { results: Brand[] } = await env.DB.prepare(brandsQuery).all();
		logInfo('fetch_brands_success', sessionId, { brandCount: brands.length });

		await env.BRANDS_KV.put(cacheKey, JSON.stringify(brands), { expirationTtl: cacheDuration });

		return brands;
	} catch (error) {
		logError('fetch_brands_error', sessionId, error);
		return [];
	}
}
