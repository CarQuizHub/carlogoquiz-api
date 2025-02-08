import { Brand, Env } from '../../types';
import { prependBaseUrl } from './utils';

export async function fetchBrands(env: Env): Promise<Brand[]> {
	const baseUrl = env.MEDIA_BASE_URL;
	const brandsQuery = 'SELECT id, brand_name, difficulty, logo, hidden_logo FROM brands;';
	try {
		const { results: brands }: { results: Brand[] } = await env.DB.prepare(brandsQuery).all();
		const updatedBrands = prependBaseUrl(brands, baseUrl);
		return updatedBrands;
	} catch (error) {
		console.error('Error fetching brands:', error);
		throw new Error('Failed to fetch brands');
	}
}
