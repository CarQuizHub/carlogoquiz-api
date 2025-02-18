import { AnswerRequest } from '../types';

export function isValidAnswerSubmission(obj: unknown): obj is AnswerRequest {
	if (typeof obj === 'object' && obj !== null && 'questionNumber' in obj && 'brandId' in obj) {
		const submission = obj as AnswerRequest;
		return Number.isInteger(submission.questionNumber) && Number.isInteger(submission.brandId);
	}
	return false;
}
