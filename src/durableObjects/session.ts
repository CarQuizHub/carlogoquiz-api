import { DurableObject } from 'cloudflare:workers';
import { createJsonResponse } from '../api/response';
import { ApiErrorResponse, SessionData, Env } from '../types';
import { handleStartSession } from '../handlers/startSessionHandler';
import { handleSubmitAnswer } from '../handlers/submitAnswerHandler';
import { handleEndSession } from '../handlers/endSessionHandler';
import { logInfo, logWarning } from '../utils/loggingUtils';

export class Session extends DurableObject {
	public env: Env;
	public state: DurableObjectState;
	public sessionData: SessionData | null = null;
	public sessionId: string;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionId = this.state.id.toString();

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

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/session/start':
				logInfo('session_start_request', this.sessionId);
				return handleStartSession(this, this.env);
			case '/session/answer':
				logInfo('session_answer_request', this.sessionId);
				return handleSubmitAnswer(this, request);
			case '/session/end':
				logInfo('session_end_request', this.sessionId);
				return handleEndSession(this);
			default:
				logWarning('unknown_route', this.sessionId, { path: url.pathname });
				return createJsonResponse<ApiErrorResponse>({ error: 'Not Found' }, 404);
		}
	}
}
