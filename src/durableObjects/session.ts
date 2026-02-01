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
	SESSION_TTL_MS,
	AlarmInfo,
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
		this.sessionData = null;
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	async alarm(alarmInfo?: AlarmInfo): Promise<void> {
		logInfo('session_expired', this.sessionId, {
			hadData: !!this.sessionData,
			isRetry: alarmInfo?.isRetry ?? false,
			retryCount: alarmInfo?.retryCount ?? 0,
		});
		this.sessionData = null;
		await this.ctx.storage.deleteAll();
	}

	async startSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_start_request', this.sessionId);
		const result = await handleStartSession(this, this.env);

		if (result.success) {
			await this.setExpirationAlarm();
		}

		return result;
	}

	async restoreSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_restore_request', this.sessionId);
		return await handleRestoreSession(this, this.env);
	}

	async submitAnswer(answerData: AnswerRequest): Promise<SubmitAnswerResult> {
		logInfo('session_answer_request', this.sessionId);
		return await handleSubmitAnswer(this, answerData, this.env.MEDIA_BASE_URL);
	}

	async endSession(): Promise<EndSessionResult> {
		logInfo('session_end_request', this.sessionId);
		return await handleEndSession(this);
	}

	private async setExpirationAlarm(): Promise<void> {
		await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
	}
}
