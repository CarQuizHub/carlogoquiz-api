export const SESSION_STATE_KEY = 'state';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface Question {
	logo: string;
}

export interface StoredQuestion extends Question {
	brandId: number;
	difficulty: number;
	mediaId: string;
}

export interface SessionData {
	score: number;
	lives: number;
	currentQuestion: number;
	questions: StoredQuestion[];
}

export interface SessionContext {
	readonly sessionId: string;
	sessionData: SessionData | null;
	save(): Promise<void>;
	clear(): Promise<void>;
}

export interface AlarmInfo {
	retryCount: number;
	isRetry: boolean;
}
