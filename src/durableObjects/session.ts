import { DurableObject } from 'cloudflare:workers';

import type { SessionData, Bindings, AnswerRequest, SubmitAnswerResult, EndSessionResult, Result, ApiStartSessionResponse } from '../types';
import { handleStartSession } from '../handlers/startSessionHandler';
import { handleRestoreSession } from '../handlers/restoreSessionHandler';
import { handleSubmitAnswer } from '../handlers/submitAnswerHandler';
import { handleEndSession } from '../handlers/endSessionHandler';
import { logInfo } from '../utils/loggingUtils';
import { loadSessionData, saveSessionData, clearSessionData } from '../stores/sessionStateStore';

export class Session extends DurableObject {
	public state: DurableObjectState;
	public env: Bindings;

	public sessionData: SessionData | null = null;

	private hydrated = false;
	private hydrationPromise: Promise<void>;

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env);
		this.state = state;
		this.env = env;

		this.hydrationPromise = state.blockConcurrencyWhile(async () => {
			await this.hydrateFromStorage();
		});
	}

	private async hydrateFromStorage(): Promise<void> {
		if (this.hydrated) return;

		const storedSession = await loadSessionData(this.state);
		this.sessionData = storedSession;
		this.hydrated = true;

		logInfo('session_initialized', this.state.id.toString(), { isRestored: !!storedSession });
	}

	private async ensureLoaded(): Promise<void> {
		await this.hydrationPromise;
	}

	async save(): Promise<void> {
		if (!this.sessionData) return;
		await saveSessionData(this.state, this.sessionData);
	}

	async clear(): Promise<void> {
		await clearSessionData(this.state);
		this.sessionData = null;
	}

	async startSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_start_request', this.state.id.toString());
		return handleStartSession(this, this.env);
	}

	async restoreSession(): Promise<Result<ApiStartSessionResponse>> {
		await this.ensureLoaded();
		logInfo('session_restore_request', this.state.id.toString());
		return handleRestoreSession(this, this.env);
	}

	async submitAnswer(answerData: AnswerRequest): Promise<SubmitAnswerResult> {
		await this.ensureLoaded();
		logInfo('session_answer_request', this.state.id.toString());
		return handleSubmitAnswer(this, answerData, this.env.MEDIA_BASE_URL);
	}

	async endSession(): Promise<EndSessionResult> {
		await this.ensureLoaded();
		logInfo('session_end_request', this.state.id.toString());
		return handleEndSession(this);
	}
}
