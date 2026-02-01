import { Brand, StoredQuestion } from '../types';

export const generateLogoUrl = (mediaId: string, isHidden: boolean, baseUrl: string): string => {
	const imageType = isHidden ? 'logo-hidden' : 'logo';
	return `${baseUrl}/brands/${mediaId}/logo/${imageType}.webp`;
};

export const generateLogoQuestions = (brands: Brand[], baseUrl: string): StoredQuestion[] => {
	const easyPoolSize = 9;
	const hardPoolDifficulties = [3, 3, 3, 4, 4, 5];
	const totalQuestions = easyPoolSize + hardPoolDifficulties.length;

	const brandsByDifficulty = groupByDifficulty(brands);
	const selectedIds = new Set<number>();

	// Select easy brands (difficulty 1-2)
	const easyPool = [...(brandsByDifficulty.get(1) ?? []), ...(brandsByDifficulty.get(2) ?? [])];
	const easyBrands = getRandomElements(easyPool, easyPoolSize);
	easyBrands.forEach((b) => selectedIds.add(b.id));

	// Select hard brands (difficulty 3-5), avoiding duplicates
	const hardBrands: Brand[] = [];
	for (const difficulty of hardPoolDifficulties) {
		const pool = (brandsByDifficulty.get(difficulty) ?? []).filter((b) => !selectedIds.has(b.id));
		const brand = getRandomElements(pool, 1)[0];
		if (brand) {
			selectedIds.add(brand.id);
			hardBrands.push(brand);
		}
	}

	const allBrands = [...easyBrands, ...hardBrands];
	if (allBrands.length !== totalQuestions) {
		return [];
	}

	return allBrands.map((brand) => ({
		brandId: brand.id,
		difficulty: brand.difficulty,
		mediaId: brand.media_id,
		logo: generateLogoUrl(brand.media_id, true, baseUrl),
	}));
};

export const calculateLogoQuizScore = (difficulty: number): number => {
	return difficulty <= 2 ? 1 : difficulty;
};

function groupByDifficulty(brands: Brand[]): Map<number, Brand[]> {
	const map = new Map<number, Brand[]>();
	for (const brand of brands) {
		const existing = map.get(brand.difficulty) ?? [];
		existing.push(brand);
		map.set(brand.difficulty, existing);
	}
	return map;
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
