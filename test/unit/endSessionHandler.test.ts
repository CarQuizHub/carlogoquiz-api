import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleEndSession } from '../../src/handlers/endSessionHandler';
import type { SessionData } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

const DO_ID = 'do-id-123';

describe('handleEndSession', () => {
	let fakeSession: {
		sessionData: SessionData | null;
		state: { id: { toString: () => string } };
		clear: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		fakeSession = {
			sessionData: {
				score: 100,
				lives: 3,
				currentQuestion: 5,
				questions: [{ logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' }],
			},
			state: { id: { toString: () => DO_ID } },
			clear: vi.fn().mockResolvedValue(undefined),
		};
	});

	it('ends session successfully and clears storage', async () => {
		const result = await handleEndSession(fakeSession as any);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.message).toBe('Session ended and memory cleared');
		}

		expect(fakeSession.clear).toHaveBeenCalledTimes(1);
	});

	it('ends session successfully when sessionData is null', async () => {
		fakeSession.sessionData = null;

		const result = await handleEndSession(fakeSession as any);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.message).toBe('Session ended and memory cleared');
		}

		expect(fakeSession.clear).toHaveBeenCalledTimes(1);
	});

	it('returns INTERNAL_ERROR when clear() throws', async () => {
		fakeSession.clear.mockRejectedValue(new Error('Storage failure'));

		const result = await handleEndSession(fakeSession as any);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
			expect(result.error.message).toBe('Failed to end session');
		}
	});
});
