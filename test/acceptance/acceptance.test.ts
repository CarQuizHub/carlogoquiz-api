import { SELF, createExecutionContext, waitOnExecutionContext, env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Session Durable Object API', () => {
	/*
	it('should start a new session', async () => {
		const request = new Request('http://example.com/session/start', { method: 'GET' });
		const ctx = createExecutionContext();
		const response = await SELF.fetch(request);

		await waitOnExecutionContext(ctx);
		console.log('DEBUG RESPONSE:', response.status, await response.text());

		expect(response.status).toBe(200);
		const body: { error: string } = await response.json();
		expect(body).toHaveProperty('brands');
		expect(body).toHaveProperty('questions');
		expect(response.headers.get('session_id')).toBeTruthy();
	});
	*/

	it('should return an error when submitting an answer without a session_id header', async () => {
		const request = new Request('http://example.com/session/answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questionNumber: 0, brandId: 1, timeTaken: 5 }),
		});

		const ctx = createExecutionContext();
		const response = await SELF.fetch(request);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Missing session ID');
	});

	it('should return an error when ending a session without a session_id header', async () => {
		const request = new Request('http://example.com/session/end', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questionNumber: 0, brandId: 1, timeTaken: 5 }),
		});

		const ctx = createExecutionContext();
		const response = await SELF.fetch(request);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		const body: { error: string } = await response.json();
		expect(body.error).toBe('Missing session ID');
	});
});
