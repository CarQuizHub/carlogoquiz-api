import { ApiStartSessionResponse, ApiSubmitAnswerResponse } from './api';

export enum SessionErrorCode {
	NO_BRANDS_AVAILABLE = 'NO_BRANDS_AVAILABLE',
	NO_QUESTIONS_AVAILABLE = 'NO_QUESTIONS_AVAILABLE',
	NO_ACTIVE_SESSION = 'NO_ACTIVE_SESSION',
	SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
	GAME_OVER = 'GAME_OVER',
	INVALID_INPUT_FORMAT = 'INVALID_INPUT_FORMAT',
	INVALID_QUESTION_NUMBER = 'INVALID_QUESTION_NUMBER',
	INVALID_SESSION_ID = 'INVALID_SESSION_ID',
	INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface SessionError {
	code: SessionErrorCode;
	message: string;
}

export type Result<T> = { success: true; data: T } | { success: false; error: SessionError };

export type StartSessionResult = Result<ApiStartSessionResponse & { sessionId: string }>;
export type RestoreSessionResult = Result<ApiStartSessionResponse & { sessionId: string }>;

export type SubmitAnswerResult = Result<ApiSubmitAnswerResponse>;
export type EndSessionResult = Result<{ message: string }>;
