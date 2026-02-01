import { SELF, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

import { ApiStartSessionResponseWithId, ApiSubmitAnswerResponse, SessionErrorCode } from '../../src/types';

async function startSession(): Promise<{ sessionId: string; data: ApiStartSessionResponseWithId }> {
	const request = new Request('http://example.com/session/start', { method: 'GET' });
	const response = await SELF.fetch(request);
	const body = (await response.json()) as ApiStartSessionResponseWithId;
	return { sessionId: body.sessionId, data: body };
}

async function submitAnswer(
	sessionId: string,
	questionNumber: number,
	brandId: number,
	timeTaken?: number,
): Promise<{ status: number; body: ApiSubmitAnswerResponse | { error: string; code?: string } }> {
	const request = new Request('http://example.com/session/answer', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			session_id: sessionId,
		},
		body: JSON.stringify({ questionNumber, brandId, timeTaken }),
	});
	const response = await SELF.fetch(request);
	const body = (await response.json()) as ApiSubmitAnswerResponse | { error: string; code?: string };
	return { status: response.status, body };
}

async function restoreSession(
	sessionId: string,
): Promise<{ status: number; body: ApiStartSessionResponseWithId | { error: string; code?: string } }> {
	const request = new Request('http://example.com/session/restore', {
		method: 'GET',
		headers: { session_id: sessionId },
	});
	const response = await SELF.fetch(request);
	const body = (await response.json()) as ApiStartSessionResponseWithId | { error: string; code?: string };
	return { status: response.status, body };
}

async function endSession(sessionId: string): Promise<{ status: number; body: { message?: string; error?: string } }> {
	const request = new Request('http://example.com/session/end', {
		method: 'GET',
		headers: { session_id: sessionId },
	});
	const response = await SELF.fetch(request);
	const body = (await response.json()) as { message?: string; error?: string };
	return { status: response.status, body };
}

describe('Session API - Start Session', () => {
	it('should start a new session with brands and questions', async () => {
		const request = new Request('http://example.com/session/start', { method: 'GET' });
		const ctx = createExecutionContext();
		const response = await SELF.fetch(request);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		const body = (await response.json()) as ApiStartSessionResponseWithId;

		// Verify session ID is returned
		expect(body.sessionId).toBeTruthy();
		expect(typeof body.sessionId).toBe('string');

		// Verify brands
		expect(body.brands).toHaveLength(89);
		expect(body.brands[0]).toHaveProperty('id');
		expect(body.brands[0]).toHaveProperty('brand_name');

		// Verify questions
		expect(body.questions).toHaveLength(15);
		expect(body.questions[0]).toHaveProperty('question');
		expect(body.questions[0].question).toHaveProperty('logo');
	});

	it('should return unique session IDs for each new session', async () => {
		const { sessionId: sessionId1 } = await startSession();
		const { sessionId: sessionId2 } = await startSession();

		expect(sessionId1).not.toBe(sessionId2);
	});

	it('should return questions with valid logo URLs', async () => {
		const { data } = await startSession();

		data.questions.forEach((q) => {
			expect(q.question.logo).toMatch(/^http/);
			expect(q.question.logo).toContain('/brands/');
		});
	});
});

describe('Session API - Restore Session', () => {
	it('should restore an existing session', async () => {
		const { sessionId, data: originalData } = await startSession();

		const { status, body } = await restoreSession(sessionId);

		expect(status).toBe(200);
		const restoredData = body as ApiStartSessionResponseWithId;
		expect(restoredData.brands).toHaveLength(89);
		expect(restoredData.questions).toHaveLength(15);
		// Questions should match the original session
		expect(restoredData.questions).toEqual(originalData.questions);
	});

	it('should return error when restoring without session_id header', async () => {
		const request = new Request('http://example.com/session/restore', { method: 'GET' });
		const response = await SELF.fetch(request);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Missing session_id header');
	});

	it('should return error when restoring with invalid session_id', async () => {
		const { status, body } = await restoreSession('invalid-session-id');

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('should return error when restoring a non-existent session', async () => {
		const fakeSessionId = '0000000000000000000000000000000000000000000000000000000000000000';
		const { status, body } = await restoreSession(fakeSessionId);

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('should return error when restoring an ended session', async () => {
		const { sessionId } = await startSession();
		await endSession(sessionId);

		const { status, body } = await restoreSession(sessionId);

		expect(status).toBe(404);
		expect((body as { code: string }).code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
	});
});

describe('Session API - Submit Answer', () => {
	it('should return error when submitting without session_id header', async () => {
		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questionNumber: 0, brandId: 1, timeTaken: 5 }),
		});

		const response = await SELF.fetch(request);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Missing session_id header');
	});

	it('should return error when submitting with invalid JSON body', async () => {
		const { sessionId } = await startSession();

		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				session_id: sessionId,
			},
			body: 'invalid json',
		});

		const response = await SELF.fetch(request);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Invalid JSON body');
	});

	it('should return error when submitting with invalid session_id', async () => {
		const { status, body } = await submitAnswer('invalid-session-id', 0, 1);

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('should return error when submitting to a non-existent session', async () => {
		const fakeSessionId = '0000000000000000000000000000000000000000000000000000000000000000';
		const { status, body } = await submitAnswer(fakeSessionId, 0, 1);

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('should return error when submitting with invalid input format', async () => {
		const { sessionId } = await startSession();

		// Missing required fields
		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				session_id: sessionId,
			},
			body: JSON.stringify({ questionNumber: 0 }), // Missing brandId
		});

		const response = await SELF.fetch(request);
		const body = await response.json();

		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
	});

	it('should return error when submitting answer for wrong question number', async () => {
		const { sessionId } = await startSession();

		// Try to answer question 5 when we should answer question 0
		const { status, body } = await submitAnswer(sessionId, 5, 1);

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
	});

	it('should return error when submitting negative question number', async () => {
		const { sessionId } = await startSession();

		const { status, body } = await submitAnswer(sessionId, -1, 1);

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
	});

	it('should accept a correct answer and return updated state', async () => {
		const { sessionId } = await startSession();

		// We need to find the correct brand for question 0
		// Since questions are randomized, we'll just submit and check the response structure
		const { status, body } = await submitAnswer(sessionId, 0, 1, 5000);

		expect(status).toBe(200);
		const response = body as ApiSubmitAnswerResponse;
		expect(response).toHaveProperty('isCorrect');
		expect(response).toHaveProperty('lives');
		expect(response).toHaveProperty('score');
		expect(response).toHaveProperty('logo');
		expect(typeof response.isCorrect).toBe('boolean');
		expect(typeof response.lives).toBe('number');
		expect(typeof response.score).toBe('number');
	});

	it('should decrement lives on incorrect answer', async () => {
		const { sessionId } = await startSession();

		// Submit an answer (likely incorrect with random brandId)
		const { body: firstAnswer } = await submitAnswer(sessionId, 0, 99999);
		const response1 = firstAnswer as ApiSubmitAnswerResponse;

		if (!response1.isCorrect) {
			expect(response1.lives).toBe(2); // Started with 3, now 2
		}
	});

	it('should not progress question number on incorrect answer', async () => {
		const { sessionId } = await startSession();

		// Submit incorrect answer for question 0
		const { body: firstAnswer } = await submitAnswer(sessionId, 0, 99999);
		const response1 = firstAnswer as ApiSubmitAnswerResponse;

		if (!response1.isCorrect) {
			// Should still be able to answer question 0
			const { status } = await submitAnswer(sessionId, 0, 99998);
			expect(status).toBe(200);
		}
	});
});

describe('Session API - Game Over', () => {
	it('should return game over error after losing all lives', async () => {
		const { sessionId } = await startSession();

		// Submit 3 wrong answers to lose all lives
		let lastResponse: ApiSubmitAnswerResponse | null = null;
		for (let i = 0; i < 3; i++) {
			const { body } = await submitAnswer(sessionId, 0, 99999 + i);
			lastResponse = body as ApiSubmitAnswerResponse;
			if (lastResponse.isCorrect) {
				// If we accidentally got it right, this test won't work as expected
				// In a real scenario, you'd need to know the correct answer to avoid it
				break;
			}
		}

		// If we lost all 3 lives
		if (lastResponse && lastResponse.lives === 0) {
			// Next submission should fail
			const { status, body } = await submitAnswer(sessionId, 0, 1);
			expect(status).toBe(409);
			expect((body as { code: string }).code).toBe(SessionErrorCode.GAME_OVER);
		}
	});
});

describe('Session API - End Session', () => {
	it('should return error when ending without session_id header', async () => {
		const request = new Request('http://example.com/session/end', {
			method: 'GET',
		});

		const response = await SELF.fetch(request);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Missing session_id header');
	});

	it('should successfully end an active session', async () => {
		const { sessionId } = await startSession();

		const { status, body } = await endSession(sessionId);

		expect(status).toBe(200);
		expect(body.message).toBe('Session ended and memory cleared');
	});

	it('should return error when ending with invalid session_id', async () => {
		const { status, body } = await endSession('invalid-session-id');

		expect(status).toBe(400);
		expect((body as { code: string }).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('should clear session data after ending', async () => {
		const { sessionId } = await startSession();

		// End the session
		await endSession(sessionId);

		// Try to restore - should fail
		const { status, body } = await restoreSession(sessionId);
		expect(status).toBe(404);
		expect((body as { code: string }).code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
	});

	it('should not allow submitting answers after session ended', async () => {
		const { sessionId } = await startSession();

		await endSession(sessionId);

		const { status, body } = await submitAnswer(sessionId, 0, 1);
		expect(status).toBe(404);
		expect((body as { code: string }).code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
	});
});

describe('Session API - Full Game Flow', () => {
	it('should complete a full session lifecycle: start → answer → end', async () => {
		// 1. Start session
		const { sessionId, data } = await startSession();
		expect(sessionId).toBeTruthy();
		expect(data.questions).toHaveLength(15);

		// 2. Submit an answer
		const { status: answerStatus, body: answerBody } = await submitAnswer(sessionId, 0, 1, 3000);
		expect(answerStatus).toBe(200);
		const answerResponse = answerBody as ApiSubmitAnswerResponse;
		expect(answerResponse).toHaveProperty('isCorrect');
		expect(answerResponse).toHaveProperty('lives');
		expect(answerResponse).toHaveProperty('score');

		// 3. Restore session (should work mid-game)
		const { status: restoreStatus } = await restoreSession(sessionId);
		expect(restoreStatus).toBe(200);

		// 4. End session
		const { status: endStatus, body: endBody } = await endSession(sessionId);
		expect(endStatus).toBe(200);
		expect(endBody.message).toBe('Session ended and memory cleared');

		// 5. Verify session is cleared
		const { status: restoreAfterEndStatus } = await restoreSession(sessionId);
		expect(restoreAfterEndStatus).toBe(404);
	});

	it('should maintain session state across multiple answers', async () => {
		const { sessionId } = await startSession();

		// Submit first answer
		const { body: first } = await submitAnswer(sessionId, 0, 1);
		const firstResponse = first as ApiSubmitAnswerResponse;
		const initialLives = firstResponse.lives;

		// If first was correct, submit for question 1; if wrong, submit for question 0 again
		const nextQuestion = firstResponse.isCorrect ? 1 : 0;
		const { body: second } = await submitAnswer(sessionId, nextQuestion, 2);
		const secondResponse = second as ApiSubmitAnswerResponse;

		// Verify state is maintained
		expect(typeof secondResponse.lives).toBe('number');
		expect(typeof secondResponse.score).toBe('number');

		// Lives should be same or less
		expect(secondResponse.lives).toBeLessThanOrEqual(initialLives);
	});
});

describe('Session API - Edge Cases', () => {
	it('should handle concurrent session starts', async () => {
		const promises = Array(5)
			.fill(null)
			.map(() => startSession());
		const results = await Promise.all(promises);

		// All should succeed with unique session IDs
		const sessionIds = results.map((r) => r.sessionId);
		const uniqueIds = new Set(sessionIds);
		expect(uniqueIds.size).toBe(5);
	});

	it('should handle very large brandId gracefully', async () => {
		const { sessionId } = await startSession();

		const { status, body } = await submitAnswer(sessionId, 0, Number.MAX_SAFE_INTEGER);

		// Should not crash, should return valid response
		expect(status).toBe(200);
		const response = body as ApiSubmitAnswerResponse;
		expect(response.isCorrect).toBe(false); // Definitely wrong answer
	});

	it('should handle zero timeTaken', async () => {
		const { sessionId } = await startSession();

		const { status } = await submitAnswer(sessionId, 0, 1, 0);

		expect(status).toBe(200);
	});

	it('should handle missing timeTaken field', async () => {
		const { sessionId } = await startSession();

		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				session_id: sessionId,
			},
			body: JSON.stringify({ questionNumber: 0, brandId: 1 }), // No timeTaken
		});

		const response = await SELF.fetch(request);
		expect(response.status).toBe(200);
	});

	it('should return proper content-type header', async () => {
		const request = new Request('http://example.com/session/start', { method: 'GET' });
		const response = await SELF.fetch(request);

		expect(response.headers.get('Content-Type')).toContain('application/json');
	});

	it('should handle empty string session_id', async () => {
		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				session_id: '',
			},
			body: JSON.stringify({ questionNumber: 0, brandId: 1 }),
		});

		const response = await SELF.fetch(request);
		// Empty string should be treated as missing or invalid
		expect(response.status).toBe(400);
	});
});

describe('Session API - HTTP Methods', () => {
	it('should return 404 for non-existent routes', async () => {
		const request = new Request('http://example.com/nonexistent', { method: 'GET' });
		const response = await SELF.fetch(request);

		expect(response.status).toBe(404);
	});

	it('should reject POST on /session/start', async () => {
		const request = new Request('http://example.com/session/start', { method: 'POST' });
		const response = await SELF.fetch(request);

		// Hono returns 404 for wrong method by default
		expect(response.status).toBe(404);
	});

	it('should reject GET on /session/answer', async () => {
		const { sessionId } = await startSession();

		const request = new Request('http://example.com/session/answer', {
			method: 'GET',
			headers: { session_id: sessionId },
		});
		const response = await SELF.fetch(request);

		expect(response.status).toBe(404);
	});

	it('should reject POST on /session/end', async () => {
		const { sessionId } = await startSession();

		const request = new Request('http://example.com/session/end', {
			method: 'POST',
			headers: { session_id: sessionId },
		});
		const response = await SELF.fetch(request);

		expect(response.status).toBe(404);
	});

	it('should reject POST on /session/restore', async () => {
		const { sessionId } = await startSession();

		const request = new Request('http://example.com/session/restore', {
			method: 'POST',
			headers: { session_id: sessionId },
		});
		const response = await SELF.fetch(request);

		expect(response.status).toBe(404);
	});
});

describe('Session API - CORS', () => {
	it('should include CORS headers in response', async () => {
		const request = new Request('http://example.com/session/start', { method: 'GET' });
		const response = await SELF.fetch(request);

		// Check for common CORS headers (adjust based on your CORS_OPTIONS)
		expect(response.headers.has('Access-Control-Allow-Origin')).toBe(true);
	});

	it('should handle OPTIONS preflight request', async () => {
		const request = new Request('http://example.com/session/start', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
				'Access-Control-Request-Method': 'GET',
			},
		});
		const response = await SELF.fetch(request);

		// Preflight should return 204 or 200
		expect([200, 204]).toContain(response.status);
	});
});
