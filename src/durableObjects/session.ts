import { DurableObject } from 'cloudflare:workers';

import {
	type SessionData,
	type SessionContext,
	type Bindings,
	type AnswerRequest,
	type SubmitAnswerResult,
	type EndSessionResult,
	type Result,
	type ApiStartSessionResponse,
	SESSION_STATE_KEY,
} from '../types';
import { handleStartSession } from '../handlers/startSessionHandler';
import { handleRestoreSession } from '../handlers/restoreSessionHandler';
import { handleSubmitAnswer } from '../handlers/submitAnswerHandler';
import { handleEndSession } from '../handlers/endSessionHandler';
import { logInfo } from '../utils/loggingUtils';

export class Session extends DurableObject<Bindings> implements SessionContext {
	public sessionData: SessionData | null = null;

	constructor(ctx: DurableObjectState, env: Bindings) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			const storedSession = await ctx.storage.get<SessionData>(SESSION_STATE_KEY);
			this.sessionData = storedSession ?? null;
			logInfo('session_initialized', ctx.id.toString(), { isRestored: !!storedSession });
		});
	}

	get sessionId(): string {
		return this.ctx.id.toString();
	}

	async save(): Promise<void> {
		if (!this.sessionData) return;
		await this.ctx.storage.put(SESSION_STATE_KEY, this.sessionData);
	}

	async clear(): Promise<void> {
		await this.ctx.storage.deleteAll();
		this.sessionData = null;
	}

	async startSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_start_request', this.sessionId);
		return handleStartSession(this, this.env);
	}

	async restoreSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_restore_request', this.sessionId);
		return handleRestoreSession(this, this.env);
	}

	async submitAnswer(answerData: AnswerRequest): Promise<SubmitAnswerResult> {
		logInfo('session_answer_request', this.sessionId);
		return handleSubmitAnswer(this, answerData, this.env.MEDIA_BASE_URL);
	}

	async endSession(): Promise<EndSessionResult> {
		logInfo('session_end_request', this.sessionId);
		return handleEndSession(this);
	}
}
