import { WorkerEntrypoint } from 'cloudflare:workers';

import app from '../api/router';
import type { Bindings, AnswerRequest, StartSessionResult, RestoreSessionResult, SubmitAnswerResult, EndSessionResult } from '../types';
import { QuizApi } from '../services/quizApi';

export class ApiWorker extends WorkerEntrypoint<Bindings> {
	private api(): QuizApi {
		return new QuizApi(this.env);
	}

	async fetch(request: Request): Promise<Response> {
		if (!this.env.EXPOSE_HTTP) {
			return new Response('Not Found', { status: 404 });
		}

		return app.fetch(request, this.env, this.ctx);
	}

	async startSession(): Promise<StartSessionResult> {
		return this.api().startSession();
	}

	async restoreSession(sessionId: string): Promise<RestoreSessionResult> {
		return this.api().restoreSession(sessionId);
	}

	async submitAnswer(sessionId: string, data: AnswerRequest): Promise<SubmitAnswerResult> {
		return this.api().submitAnswer(sessionId, data);
	}

	async endSession(sessionId: string): Promise<EndSessionResult> {
		return this.api().endSession(sessionId);
	}
}
