import { DurableObject } from 'cloudflare:workers';
import type { SessionData, Bindings, AnswerRequest, SubmitAnswerResult, EndSessionResult, Result, ApiStartSessionResponse } from '../types';
import { handleStartSession } from '../handlers/startSessionHandler';
import { handleRestoreSession } from '../handlers/restoreSessionHandler';
import { handleSubmitAnswer } from '../handlers/submitAnswerHandler';
import { handleEndSession } from '../handlers/endSessionHandler';
import { logInfo } from '../utils/loggingUtils';

export class Session extends DurableObject {
	public state: DurableObjectState;
	public sessionData: SessionData | null = null;
	public env: Bindings;

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env);
		this.state = state;
		this.env = env;

		state.blockConcurrencyWhile(async () => {
			const storedSession = await state.storage.get<SessionData>('state');
			this.sessionData = storedSession ?? null;
			logInfo('session_initialized', state.id.toString(), { isRestored: !!storedSession });
		});
	}

	async startSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_start_request', this.state.id.toString());
		return handleStartSession(this, this.env);
	}

	async restoreSession(): Promise<Result<ApiStartSessionResponse>> {
		logInfo('session_restore_request', this.state.id.toString());
		return handleRestoreSession(this, this.env);
	}

	async submitAnswer(answerData: AnswerRequest): Promise<SubmitAnswerResult> {
		logInfo('session_answer_request', this.state.id.toString());
		return handleSubmitAnswer(this, answerData, this.env.MEDIA_BASE_URL);
	}

	async endSession(): Promise<EndSessionResult> {
		logInfo('session_end_request', this.state.id.toString());
		return handleEndSession(this);
	}
}
