import { Brand, Env } from '../../types';

export async function fetchBrands(env: Env): Promise<Brand[]> {
	const brandsQuery = 'SELECT id, brand_name, difficulty, media_id FROM brands;';
	try {
		const { results: brands }: { results: Brand[] } = await env.DB.prepare(brandsQuery).all();
		return brands;
	} catch (error) {
		console.error('Error fetching brands:', error);
		throw new Error('Failed to fetch brands');
	}
}
