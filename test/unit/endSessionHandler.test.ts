import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleEndSession } from '../../src/handlers/endSessionHandler';
import type { SessionData } from '../../src/types';

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
		const response = await handleEndSession(fakeSession as any);
		const data = await response.json();

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(response.status).toBe(200);
		expect(data).toEqual({ message: 'Session ended and memory cleared' });
	});

	it('ends the session and clears stored data when sessionData is missing', async () => {
		fakeSession.sessionData = null;
		const response = await handleEndSession(fakeSession as any);
		const data = await response.json();

		expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
		expect(fakeSession.sessionData).toBeNull();
		expect(response.status).toBe(200);
		expect(data).toEqual({ message: 'Session ended and memory cleared' });
	});

	it('handles errors and returns a 500 error', async () => {
		fakeSession.state.storage.deleteAll.mockRejectedValue(new Error('DB error'));

		const response = await handleEndSession(fakeSession as any);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({ error: 'Error: Failed to end session' });
	});
});
