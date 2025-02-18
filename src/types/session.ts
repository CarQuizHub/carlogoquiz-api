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
	questions: Record<number, StoredQuestion>;
}
