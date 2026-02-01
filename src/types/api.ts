import { createJsonResponse } from '../api/response';
import { Question } from './session';

export type JsonResponse<T> = Promise<ReturnType<typeof createJsonResponse<T>>>;

export interface AnswerRequest {
	questionNumber: number;
	brandId: number;
	timeTaken: number | null;
}

export interface ApiStartSessionResponse {
	brands: {
		id: number;
		brand_name: string;
	}[];
	questions: {
		question: Question;
	}[];
}

export interface ApiSubmitAnswerResponse {
	isCorrect: boolean;
	score: number;
	lives: number;
	logo: string;
}

export interface ApiStartSessionResponseWithId extends ApiStartSessionResponse {
	sessionId: string;
}
