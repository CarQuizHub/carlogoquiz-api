import type { Bindings } from '../types';
import type {
	AnswerRequest,
	StartSessionResult,
	RestoreSessionResult,
	SubmitAnswerResult,
	EndSessionResult,
	Result,
	ApiStartSessionResponse,
} from '../types';
import type { Session } from '../durableObjects/session';
import { SessionErrorCode } from '../types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPublicSessionId(sessionId: string): boolean {
	return UUID_V4_REGEX.test(sessionId);
}

export class QuizApi {
	constructor(private env: Bindings) {}

	private getStub(sessionId: string): Session {
		const id = this.env.SESSION.idFromName(sessionId);
		return this.env.SESSION.get(id) as unknown as Session;
	}

	async startSession(): Promise<StartSessionResult> {
		const publicSessionId = crypto.randomUUID();

		const stub = this.getStub(publicSessionId);
		const inner: Result<ApiStartSessionResponse> = await stub.startSession();

		if (!inner.success) {
			return { success: false, error: inner.error };
		}

		return {
			success: true,
			data: {
				sessionId: publicSessionId,
				...inner.data,
			},
		};
	}

	async restoreSession(sessionId: string): Promise<RestoreSessionResult> {
		if (!isValidPublicSessionId(sessionId)) {
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_SESSION_ID, message: 'Invalid session_id' },
			};
		}

		const stub = this.getStub(sessionId);
		const inner: Result<ApiStartSessionResponse> = await stub.restoreSession();

		if (!inner.success) {
			return { success: false, error: inner.error };
		}

		return {
			success: true,
			data: {
				sessionId,
				...inner.data,
			},
		};
	}

	async submitAnswer(sessionId: string, data: AnswerRequest): Promise<SubmitAnswerResult> {
		if (!isValidPublicSessionId(sessionId)) {
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_SESSION_ID, message: 'Invalid session_id' },
			};
		}
		const stub = this.getStub(sessionId);
		return stub.submitAnswer(data);
	}

	async endSession(sessionId: string): Promise<EndSessionResult> {
		if (!isValidPublicSessionId(sessionId)) {
			return {
				success: false,
				error: { code: SessionErrorCode.INVALID_SESSION_ID, message: 'Invalid session_id' },
			};
		}
		const stub = this.getStub(sessionId);
		return stub.endSession();
	}
}
