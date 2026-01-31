import { WorkerEntrypoint } from 'cloudflare:workers';
import { Session } from './durableObjects/session';
import app from './api/router';
import type { Bindings, AnswerRequest, StartSessionResult, SubmitAnswerResult, EndSessionResult, RestoreSessionResult } from './types';
import { QuizApi } from './services/quizApi';

export class ApiWorker extends WorkerEntrypoint<Bindings> {
	private api(): QuizApi {
		return new QuizApi(this.env);
	}

	async fetch(request: Request): Promise<Response> {
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

export { Session };
export { app as honoApp };
export default ApiWorker;
