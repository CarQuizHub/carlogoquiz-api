import { Brand, StoredQuestion, Bindings } from '../types';

export const generateLogoUrl = (mediaId: string, isHidden: boolean, baseUrl: string): string => {
	const imageType = isHidden ? 'logo-hidden' : 'logo';
	return `${baseUrl}/brands/${mediaId}/logo/${imageType}.webp`;
};

export const generateLogoQuestions = (brands: Brand[], baseUrl: string): StoredQuestion[] => {
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

	const remainingQuestions = hardPoolDifficultyOrder
		.map((difficulty) => {
			const pool = (groupedBrands[difficulty] || []).filter((b) => !selectedIds.has(b.id));
			const brand = getRandomElements(pool, 1)[0];
			if (brand) {
				selectedIds.add(brand.id);
				return brand;
			}
			return null;
		})
		.filter(Boolean);

	const questions = [...easyBrands, ...remainingQuestions];
	if (questions.length !== easyPoolNumber + hardPoolDifficultyOrder.length) {
		return [];
	}

	return questions.map((brand) => ({
		brandId: brand!.id,
		difficulty: brand!.difficulty,
		mediaId: brand!.media_id,
		logo: generateLogoUrl(brand!.media_id, true, baseUrl),
	}));
};

export const calculateLogoQuizScore = (difficulty: number): number => {
	return difficulty <= 2 ? 1 : difficulty;
};

const getRandomElements = <T>(array: T[], count: number): T[] => {
	if (array.length <= count) return [...array];

	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
};
