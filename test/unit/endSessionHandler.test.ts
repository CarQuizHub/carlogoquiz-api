import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEndSession } from '../../src/handlers/endSessionHandler';
import type { SessionData } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

const SESSION_ID = 'test-session';

describe('handleEndSession', () => {
	let fakeSession: {
		sessionId: string;
		sessionData: SessionData | null;
		state: {
			storage: {
				deleteAll: ReturnType<typeof vi.fn>;
			};
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();
		fakeSession = {
			sessionId: SESSION_ID,
			sessionData: { score: 100, lives: 3, currentQuestion: 0, questions: {} },
			state: {
				storage: {
					deleteAll: vi.fn().mockResolvedValue(undefined),
				},
			},
		};
	});

	it(' ends the session and clears stored data when sessionData exists', async () => {
		const result = await handleEndSession(fakeSession as any);

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ message: 'Session ended and memory cleared' });
		}
	});

	it('ends the session and clears stored data when sessionData is missing', async () => {
		fakeSession.sessionData = null;
		const result = await handleEndSession(fakeSession as any);

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ message: 'Session ended and memory cleared' });
		}
	});

	it('handles errors and returns an error result', async () => {
		fakeSession.state.storage.deleteAll.mockRejectedValue(new Error('DB error'));

		const result = await handleEndSession(fakeSession as any);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to end session');
		}
	});
});
