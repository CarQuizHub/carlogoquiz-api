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
}

export interface AnswerSubmission {
	questionNumber: number;
	brandId: number;
}

export interface SessionData {
	score: number;
	questions: Record<number, StoredQuestion>;
	//currentQuestion: { question_id: number; correct_answer_id: number } | null;
}

export interface Env {
	DB: D1Database;
	SESSION_DO: DurableObjectNamespace;
	MEDIA_BASE_URL: string;
	R2_BUCKET_URL: string;
	PRODUCTION: string;
}
