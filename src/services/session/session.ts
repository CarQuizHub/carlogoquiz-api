import { DurableObject } from 'cloudflare:workers';
import { SessionData, Env, Brand, Question } from '../../types';
import { fetchBrands } from './brandRepository';
import { prependBaseUrl, generateLogoQuestions } from './utils';

export class Session extends DurableObject {
	public env: Env;
	private state: DurableObjectState;
	private sessionData: SessionData;
	private db: D1Database;
	private baseUrl: string;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.db = env.DB;
		this.sessionData = { score: 0, currentQuestion: null };
		this.baseUrl = this.env.PRODUCTION === 'false' ? this.env.MEDIA_BASE_URL : this.env.R2_BUCKET_URL;
	}

	async fetch(request: Request) {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/session/start':
				return this.startSession();
			default:
				return new Response('Not Found', { status: 404 });
		}
	}

	private async startSession() {
		try {
			const brands = await fetchBrands(this.db);
			if (!brands.length) {
				return new Response(JSON.stringify({ error: 'No brands available' }), { status: 400 });
			}

			const updatedBrands = prependBaseUrl(brands, this.baseUrl);
			const questions = generateLogoQuestions(updatedBrands);

			return new Response(
				JSON.stringify({
					brands: updatedBrands.map((brand) => ({ brandId: brand.id, brandName: brand.brand_name })),
					questions,
				}),
				{ status: 200 },
			);
		} catch (error) {
			console.error('Error starting session:', error);
			return new Response(JSON.stringify({ error: 'Error: Failed to start session' }), { status: 500 });
		}
	}
}
