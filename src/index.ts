import { WorkerEntrypoint } from 'cloudflare:workers';
import { Session } from './durableObjects/session';
import app from './api/router';
import {
	Bindings,
	AnswerRequest,
	StartSessionResult,
	SubmitAnswerResult,
	EndSessionResult,
} from './types';

/**
 * Exposes RPC methods for FE worker to call via service binding.
 * Also handles HTTP requests via the fetch method for local dev/testing.
 */
export class ApiWorker extends WorkerEntrypoint<Bindings> {
	/**
	 * Handles HTTP requests - delegates to Hono router.
	 * Used for local development, Postman testing, and acceptance tests.
	 */
	async fetch(request: Request): Promise<Response> {
		return app.fetch(request, this.env, this.ctx);
	}

	/**
	 * Starts a new session or restores an existing one.
	 * @param sessionId - Optional existing session ID. If not provided, creates a new session.
	 * @returns StartSessionResult with session data including the sessionId.
	 */
	async startSession(sessionId?: string): Promise<StartSessionResult> {
		const id = sessionId
			? this.env.SESSION.idFromString(sessionId)
			: this.env.SESSION.newUniqueId();
		const stub = this.env.SESSION.get(id);
		return stub.startSession();
	}

	/**
	 * Submits an answer for the current question.
	 * @param sessionId - The session ID.
	 * @param data - The answer data (questionNumber, brandId, timeTaken).
	 * @returns SubmitAnswerResult with correctness, score, lives, and logo.
	 */
	async submitAnswer(sessionId: string, data: AnswerRequest): Promise<SubmitAnswerResult> {
		const id = this.env.SESSION.idFromString(sessionId);
		const stub = this.env.SESSION.get(id);
		return stub.submitAnswer(data);
	}

	/**
	 * Ends the session and clears stored data.
	 * @param sessionId - The session ID.
	 * @returns EndSessionResult with confirmation message.
	 */
	async endSession(sessionId: string): Promise<EndSessionResult> {
		const id = this.env.SESSION.idFromString(sessionId);
		const stub = this.env.SESSION.get(id);
		return stub.endSession();
	}
}

export { Session };

export { app as honoApp };

export default ApiWorker;
