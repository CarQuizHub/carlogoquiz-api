import type {
	AnswerRequest,
	StartSessionResult,
	RestoreSessionResult,
	SubmitAnswerResult,
	EndSessionResult,
	Bindings,
	RPCError,
} from '../types';
import { SessionErrorCode } from '../types';

export class QuizApi {
	constructor(private env: Bindings) {}

	async startSession(): Promise<StartSessionResult> {
		const id = this.env.SESSION.newUniqueId();
		const sessionId = id.toString();

		const stub = this.env.SESSION.get(id);
		const inner = await stub.startSession();

		if (!inner.success) return inner;

		return {
			success: true,
			data: {
				sessionId,
				...inner.data,
			},
		};
	}

	async restoreSession(sessionId: string): Promise<RestoreSessionResult> {
		const id = this.parseSessionId(sessionId);
		if (!id) return this.invalidSessionIdError();

		const stub = this.env.SESSION.get(id);
		const inner = await stub.restoreSession();

		if (!inner.success) return inner;

		return {
			success: true,
			data: {
				sessionId,
				...inner.data,
			},
		};
	}

	async submitAnswer(sessionId: string, data: AnswerRequest): Promise<SubmitAnswerResult> {
		const id = this.parseSessionId(sessionId);
		if (!id) return this.invalidSessionIdError();

		const stub = this.env.SESSION.get(id);
		return stub.submitAnswer(data);
	}

	async endSession(sessionId: string): Promise<EndSessionResult> {
		const id = this.parseSessionId(sessionId);
		if (!id) return this.invalidSessionIdError();

		const stub = this.env.SESSION.get(id);
		return stub.endSession();
	}

	private parseSessionId(sessionId: string): DurableObjectId | null {
		try {
			return this.env.SESSION.idFromString(sessionId);
		} catch {
			return null;
		}
	}

	private invalidSessionIdError(): RPCError {
		return {
			success: false,
			error: { code: SessionErrorCode.INVALID_SESSION_ID, message: 'Invalid session_id' },
		};
	}
}
