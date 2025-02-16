import { Brand, AnswerRequest, StoredQuestion, Env } from '../../types';

export function GenerateLogoUrl(mediaId: string, isHidden: boolean, baseUrl: string): string {
	const imageType = isHidden ? 'logo-hidden' : 'logo';
	return `${baseUrl}/brands/${mediaId}/${imageType}?format=auto`;
}

export function generateLogoQuestions(brands: Brand[], env: Env): StoredQuestion[] {
	const baseUrl = env.MEDIA_BASE_URL;
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
	return selectedBrands.map((brand) => ({
		brandId: brand.id,
		difficulty: brand.difficulty,
		mediaId: brand.media_id,
		logo: GenerateLogoUrl(brand.media_id, true, baseUrl),
	}));
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
