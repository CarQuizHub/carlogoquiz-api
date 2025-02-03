import { DurableObject } from 'cloudflare:workers';

export interface Env {
	DB: D1Database;
	SESSION_DO: DurableObjectNamespace;
}

interface Brand {
	id: number;
	brand_name: string;
	hidden_logo: string;
	logo: string;
	difficulty: number;
}

interface Question {
	logo: string;
	brand_id: number;
}

interface SessionData {
	score: number;
	currentQuestion: { question_id: number; correct_answer_id: number } | null;
}

export class Session extends DurableObject {
	public env: Env;
	private state: DurableObjectState;
	private sessionData: SessionData;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionData = { score: 0, currentQuestion: null };
	}

	async fetch(request: Request) {
		const url = new URL(request.url);

		if (url.pathname === '/session/start') {
			return this.startSession();
		}

		return new Response('Not Found', { status: 404 });
	}

	async startSession() {
		try {
			const brands = await this.fetchBrands();
			if (!brands.length) {
				return new Response(JSON.stringify({ error: 'No brands available' }), { status: 400 });
			}

			const questions = this.generateQuestions(brands);

			return new Response(
				JSON.stringify({
					brands: brands.map((brand) => ({ brandId: brand.id, brandName: brand.brand_name })),
					questions,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Failed to start session' }), { status: 500 });
		}
	}

	async fetchBrands(): Promise<Brand[]> {
		const brandsQuery = 'SELECT id, brand_name, difficulty, logo, hidden_logo FROM brands';
		const { results: brands }: { results: Brand[] } = await this.env.DB.prepare(brandsQuery).all();
		return brands;
	}

	generateQuestions(brands: Brand[]): Question[] {
		const difficultyMap: Record<number, number> = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
		const questions: Question[] = [];

		for (const [difficulty, count] of Object.entries(difficultyMap)) {
			const difficultyBrands = brands.filter((brand) => brand.difficulty === Number(difficulty));
			const selectedBrands = this.getRandomElements(difficultyBrands, count);
			selectedBrands.forEach((brand) => {
				questions.push({ logo: brand.hidden_logo, brand_id: brand.id });
			});
		}

		return questions;
	}

	getRandomElements<T>(array: T[], count: number): T[] {
		const shuffled = array.sort(() => 0.5 - Math.random());
		return shuffled.slice(0, count);
	}
}
