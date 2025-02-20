import { createJsonResponse } from '../api/response';
import { logWarning, logError } from '../utils/';

/**
 * Handles Durable Object requests with retry logic.
 */
export async function fetchWithRetries(sessionObject: DurableObjectStub, request: Request, sessionId: string) {
	const maxAttempts = 3;
	const baseBackoffMs = 100;
	const maxBackoffMs = 2000;

	let attempt = 0;

	while (true) {
		try {
			return await sessionObject.fetch(
				new Request(request.url, {
					method: request.method,
					body: request.body,
				}),
			);
		} catch (error: any) {
			if (!error.retryable) {
				logError('session_error', sessionId, error);
				return createJsonResponse({ error: 'Failed to handle session' }, 500);
			}

			if (error.overloaded) {
				logWarning('session_overloaded', sessionId);
				return createJsonResponse({ error: 'Service is overloaded. Try again later.' }, 503);
			}

			// Exponential backoff
			let backoffMs = Math.min(maxBackoffMs, baseBackoffMs * Math.random() * Math.pow(2, attempt));

			attempt += 1;
			if (attempt >= maxAttempts) {
				logError('session_max_retries_exceeded', sessionId, error);
				return createJsonResponse({ error: 'Service unavailable. Please try again later.' }, 503);
			}

			logWarning('session_retrying', sessionId, { attempt, backoffMs });
			await new Promise((resolve) => setTimeout(resolve, backoffMs));
		}
	}
}
