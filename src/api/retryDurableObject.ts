import { createJsonResponse } from './response';
import { logWarning, logError } from '../utils';

/**
 * Calls a stub function with retry logic and error handling.
 * @returns The resolved value of the stub function or a JSON error response.
 */
export async function retryDurableObject<T>(
	fn: () => Promise<T>,
	sessionId: string = 'unknown',
	maxAttempts: number = 3,
	baseBackoffMs: number = 100,
	maxBackoffMs: number = 2000,
): Promise<T> {
	let attempt = 0;

	while (true) {
		try {
			return await fn();
		} catch (error: any) {
			// Check if the error is non-retryable.
			if (!error.retryable) {
				logError('session_error', sessionId, error);
				return createJsonResponse({ error: 'Failed to handle session' }, 500) as unknown as T;
			}

			// Check if the error indicates an overloaded service.
			if (error.overloaded) {
				logWarning('session_overloaded', sessionId);
				return createJsonResponse({ error: 'Service is overloaded. Try again later.' }, 503) as unknown as T;
			}

			// Calculate exponential backoff.
			const backoffMs = Math.min(maxBackoffMs, baseBackoffMs * Math.random() * Math.pow(2, attempt));
			attempt += 1;

			// If we've exceeded the max attempts, log and return an error.
			if (attempt >= maxAttempts) {
				logError('session_max_retries_exceeded', sessionId, error);
				return createJsonResponse({ error: 'Service unavailable. Please try again later.' }, 503) as unknown as T;
			}

			logWarning('session_retrying', sessionId, { attempt, backoffMs });
			await new Promise((resolve) => setTimeout(resolve, backoffMs));
		}
	}
}
