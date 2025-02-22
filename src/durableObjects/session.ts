import { DurableObject } from 'cloudflare:workers';
import { SessionData, Bindings } from '../types';
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
			this.sessionData = {
				score: storedSession?.score ?? 0,
				lives: storedSession?.lives ?? 3,
				currentQuestion: storedSession?.currentQuestion ?? 0,
				questions: storedSession?.questions ?? {},
			};
			logInfo('session_initialized', this.sessionId, { isRestored: !!storedSession });
		});
	}

	async startSession(): Promise<Response> {
		logInfo('session_start_request', this.sessionId);
		return handleStartSession(this, this.env);
	}

	async submitAnswer(request: Request): Promise<Response> {
		logInfo('session_answer_request', this.sessionId);
		return handleSubmitAnswer(this, request, this.env.MEDIA_BASE_URL);
	}

	async endSession(): Promise<Response> {
		logInfo('session_end_request', this.sessionId);
		return handleEndSession(this);
	}
}
