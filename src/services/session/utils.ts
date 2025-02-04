import { Brand, Question } from '../../types';

export function prependBaseUrl(brands: Brand[], baseUrl: string): Brand[] {
	return brands.map((brand) => ({
		...brand,
		logo: `${baseUrl}/${brand.logo}`,
		hidden_logo: `${baseUrl}/${brand.hidden_logo}`,
	}));
}

export function generateLogoQuestions(brands: Brand[]): Question[] {
	const difficultyMap: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
	const questions: Question[] = [];

	for (const [difficulty, count] of Object.entries(difficultyMap)) {
		const difficultyBrands = brands.filter((brand) => brand.difficulty === Number(difficulty));
		const selectedBrands = getRandomElements(difficultyBrands, count);
		selectedBrands.forEach((brand) => {
			questions.push({ logo: brand.hidden_logo });
		});
	}

	return questions;
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
