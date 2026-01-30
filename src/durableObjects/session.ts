import { DurableObject } from 'cloudflare:workers';
import { SessionData, Bindings, AnswerRequest, StartSessionResult, SubmitAnswerResult, EndSessionResult } from '../types';
import { handleStartSession } from '../handlers/startSessionHandler';
import { handleSubmitAnswer } from '../handlers/submitAnswerHandler';
import { handleEndSession } from '../handlers/endSessionHandler';
import { logInfo } from '../utils/loggingUtils';

export class Session extends DurableObject {
	public state: DurableObjectState;
	public sessionData: SessionData | null = null;
	public sessionId: string;
	public env: Bindings;

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env);
		this.state = state;
		this.sessionId = this.state.id.toString();
		this.env = env;

		// Initialize or restore session state
		state.blockConcurrencyWhile(async () => {
			const storedSession = await state.storage.get<SessionData>(`session-${this.sessionId}`);
			this.sessionData = storedSession ?? null;
			logInfo('session_initialized', this.sessionId, { isRestored: !!storedSession });
		});
	}

	async startSession(): Promise<StartSessionResult> {
		logInfo('session_start_request', this.sessionId);
		return handleStartSession(this, this.env);
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
