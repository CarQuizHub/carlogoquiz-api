import { describe, it, expect } from 'vitest';

import { getApi, createAnswerRequest, getSessionState } from './../testHelper';
import { SessionErrorCode } from '../../../src/types';

describe('endSession', () => {
	it('successfully ends an active session', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const result = await api.endSession(startResult.data.sessionId);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.message).toBe('Session ended and memory cleared');
	});

	it('clears session state after ending', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;

		await api.endSession(sessionId);

		const sessionState = await getSessionState(sessionId);
		expect(sessionState).toBeNull();
	});

	it('returns INVALID_SESSION_ID for malformed session id', async () => {
		const result = await getApi().endSession('invalid-session-id');

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('prevents submitting answers after session ended', async () => {
		const api = getApi();
		const startResult = await api.startSession();
		expect(startResult.success).toBe(true);
		if (!startResult.success) return;

		const sessionId = startResult.data.sessionId;

		await api.endSession(sessionId);

		const result = await api.submitAnswer(sessionId, createAnswerRequest(0, 1));

		expect(result.success).toBe(false);
		if (result.success) return;

		expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
	});
});
