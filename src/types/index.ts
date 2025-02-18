import { DurableObjectNamespace } from '@cloudflare/workers-types';
import { createJsonResponse } from './../utils/response';
import { Session } from '../services/session/session';

export type JsonResponse<T> = Promise<ReturnType<typeof createJsonResponse<T>>>;

export interface Brand {
	id: number;
	brand_name: string;
	difficulty: number;
	media_id: string;
}

export interface Question {
	logo: string;
}

export interface StoredQuestion extends Question {
	brandId: number;
	difficulty: number;
	mediaId: string;
}
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

export interface ApiErrorResponse {
	error: string;
}

export interface SessionData {
	score: number;
	lives: number;
	currentQuestion: number;
	questions: Record<number, StoredQuestion>;
}

export interface Env {
	DB: D1Database;
	BRANDS_KV: KVNamespace;
	SESSION_DO: DurableObjectNamespace<Session>;
	MEDIA_BASE_URL: string;
	PRODUCTION: boolean;
	BRANDS_CACHE_DURATION: string;
}
