import { createJsonResponse } from './../utils/response';

export type JsonResponse<T> = Promise<ReturnType<typeof createJsonResponse<T>>>;

export interface Brand {
	id: number;
	brand_name: string;
	difficulty: number;
	logo: string;
	hidden_logo: string;
}

export interface Question {
	logo: string;
}

export interface StoredQuestion extends Question {
	brandId: number;
	difficulty: number;
}
export interface AnswerRequest {
	questionNumber: number;
	brandId: number;
}

export interface ApiStartSessionResponse {
	sessionId: string;
	brands: { id: number; brand_name: string }[];
	questions: { question: Question }[];
}

export interface ApiSubmitAnswerResponse {
	correct: boolean;
	score: number;
	lives: number;
}

export interface ApiErrorResponse {
	error: string;
}

export interface SessionData {
	score: number;
	lives: number;
	questions: Record<number, StoredQuestion>;
	//currentQuestion: { question_id: number; correct_answer_id: number } | null;
}

export interface Env {
	DB: D1Database;
	SESSION_DO: DurableObjectNamespace;
	MEDIA_BASE_URL: string;
	PRODUCTION: string;
}
