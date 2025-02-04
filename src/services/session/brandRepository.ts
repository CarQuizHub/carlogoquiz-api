import { Brand, Env } from '../../types';
import { prependBaseUrl } from './utils';

export async function fetchBrands(env: Env): Promise<Brand[]> {
	const baseUrl = env.PRODUCTION === 'false' ? env.MEDIA_BASE_URL : env.R2_BUCKET_URL;
	const brandsQuery = 'SELECT * FROM brands';
	try {
		const { results: brands }: { results: Brand[] } = await env.DB.prepare(brandsQuery).all();
		const updatedBrands = prependBaseUrl(brands, baseUrl);
		return updatedBrands;
	} catch (error) {
		console.error('Error fetching brands:', error);
		throw new Error('Failed to fetch brands');
	}
}
