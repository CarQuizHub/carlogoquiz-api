import { Brand, Env } from '../../types';

const cacheKey = 'brands';

export async function fetchBrands(env: Env, sessionId: string): Promise<Brand[]> {
	const cacheDuration = parseInt(env.BRANDS_CACHE_DURATION) || 604800; // Default to 1 week if not set

	const brandsQuery = 'SELECT id, brand_name, difficulty, media_id FROM brands;';
	try {
		const cachedData = await env.BRANDS_KV.get(cacheKey, 'json');
		if (cachedData) {
			console.log({ event: 'fetch_brands_cache_hit', sessionId });
			return cachedData as Brand[];
		}

		console.log({ event: 'fetch_brands_cache_miss', sessionId });
		const { results: brands }: { results: Brand[] } = await env.DB.prepare(brandsQuery).all();
		console.log({ event: 'fetch_brands_success', sessionId, brandCount: brands.length });

		await env.BRANDS_KV.put(cacheKey, JSON.stringify(brands), { expirationTtl: cacheDuration });

		return brands;
	} catch (error) {
		console.error({
			event: 'fetch_brands_error',
			sessionId,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
		});

		return [];
	}
}
