import { Brand } from '../../types';

export async function fetchBrands(db: D1Database): Promise<Brand[]> {
	const brandsQuery = 'SELECT * FROM brands';
	try {
		const { results: brands }: { results: Brand[] } = await db.prepare(brandsQuery).all();
		return brands;
	} catch (error) {
		console.error('Error fetching brands:', error);
		throw new Error('Failed to fetch brands');
	}
}
