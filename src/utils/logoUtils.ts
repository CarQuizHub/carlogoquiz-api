import { Brand, StoredQuestion, Env } from '../types';

export function GenerateLogoUrl(mediaId: string, isHidden: boolean, baseUrl: string): string {
	const imageType = isHidden ? 'logo-hidden' : 'logo';
	return `${baseUrl}/brands/${mediaId}/logo/${imageType}.webp`;
}

export function generateLogoQuestions(brands: Brand[], env: Env): StoredQuestion[] {
	const baseUrl = env.MEDIA_BASE_URL;
	const easyPoolNumber = 9;
	const hardPoolDifficultyOrder = [3, 3, 3, 4, 4, 5];

	const groupedBrands: Record<number, Brand[]> = {};
	brands.forEach((brand) => {
		if (!groupedBrands[brand.difficulty]) groupedBrands[brand.difficulty] = [];
		groupedBrands[brand.difficulty].push(brand);
	});

	const selectedIds = new Set<number>();
	const easyBrands = getRandomElements((groupedBrands[1] || []).concat(groupedBrands[2] || []), easyPoolNumber);
	easyBrands.forEach((b) => selectedIds.add(b.id));

	const remainingQuestions = hardPoolDifficultyOrder.map((difficulty) => {
		const pool = (groupedBrands[difficulty] || []).filter((b) => !selectedIds.has(b.id));
		const brand = getRandomElements(pool, 1)[0];
		if (brand) selectedIds.add(brand.id);
		return brand;
	});

	return [...easyBrands, ...remainingQuestions].map((brand) => ({
		brandId: brand.id,
		difficulty: brand.difficulty,
		mediaId: brand.media_id,
		logo: GenerateLogoUrl(brand.media_id, true, baseUrl),
	}));
}

export function calculateLogoQuizScore(difficulty: number): number {
	return difficulty <= 2 ? 1 : difficulty;
}

function getRandomElements<T>(array: T[], count: number): T[] {
	if (array.length <= count) return [...array];

	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
}
