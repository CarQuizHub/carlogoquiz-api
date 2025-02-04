export interface SessionData {
	score: number;
	currentQuestion: { question_id: number; correct_answer_id: number } | null;
}

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

export interface Env {
	DB: D1Database;
	SESSION_DO: DurableObjectNamespace;
	MEDIA_BASE_URL: string;
	R2_BUCKET_URL: string;
	PRODUCTION: string;
}
