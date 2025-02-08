import { Brand, AnswerRequest, StoredQuestion } from '../../types';

export function prependBaseUrl(brands: Brand[], baseUrl: string): Brand[] {
	return brands.map((brand) => ({
		...brand,
		logo: `${baseUrl}/${brand.logo}`,
		hidden_logo: `${baseUrl}/${brand.hidden_logo}`,
	}));
}

export function generateLogoQuestions(brands: Brand[]): StoredQuestion[] {
	const easyPoolNumber = 9;
	const hardPoolDifficultyOrder = [3, 3, 3, 4, 4, 5];

	const groupedBrands: Record<number, Brand[]> = brands.reduce(
		(acc, brand) => {
			acc[brand.difficulty] = acc[brand.difficulty] || [];
			acc[brand.difficulty].push(brand);
			return acc;
		},
		{} as Record<number, Brand[]>,
	);

	const easyPool = [...(groupedBrands[1] || []), ...(groupedBrands[2] || [])];
	const firstNine = getRandomElements(easyPool, easyPoolNumber);

	const remainingQuestions = hardPoolDifficultyOrder.map((difficulty) => getRandomElements(groupedBrands[difficulty] || [], 1)).flat();

	const selectedBrands = [...firstNine, ...remainingQuestions];
	return selectedBrands.map((brand) => ({ brandId: brand.id, logo: brand.hidden_logo, difficulty: brand.difficulty }));
}

export function isValidAnswerSubmission(obj: unknown): obj is AnswerRequest {
	if (typeof obj === 'object' && obj !== null && 'questionNumber' in obj && 'brandId' in obj) {
		const submission = obj as AnswerRequest;
		return Number.isInteger(submission.questionNumber) && Number.isInteger(submission.brandId);
	}
	return false;
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
