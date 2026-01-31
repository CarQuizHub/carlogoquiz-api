import { logWarning, logError } from '../utils';
import { Result, SessionErrorCode } from '../types';

/**
 * Calls a stub function with retry logic and error handling.
 * @returns The resolved Result value of the stub function or an error Result.
 */
export async function retryDurableObject<T>(
	fn: () => Promise<Result<T>>,
	sessionId = 'unknown',
	maxAttempts = 3,
	baseBackoffMs = 100,
	maxBackoffMs = 2000,
): Promise<Result<T>> {
	let attempt = 0;

	while (true) {
		try {
			return await fn();
		} catch (error: any) {
			// Check if the error is non-retryable.
			if (!error.retryable) {
				logError('session_error', sessionId, error);
				return {
					success: false,
					error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Failed to handle session' },
				};
			}

			// Check if the error indicates an overloaded service.
			if (error.overloaded) {
				logWarning('session_overloaded', sessionId);
				return {
					success: false,
					error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Service is overloaded. Try again later.' },
				};
			}

			// Calculate exponential backoff.
			const backoffMs = Math.min(maxBackoffMs, baseBackoffMs * Math.random() * Math.pow(2, attempt));
			attempt += 1;

			// If we've exceeded the max attempts, log and return an error.
			if (attempt >= maxAttempts) {
				logError('session_max_retries_exceeded', sessionId, error);
				return {
					success: false,
					error: { code: SessionErrorCode.INTERNAL_ERROR, message: 'Service unavailable. Please try again later.' },
				};
			}

			logWarning('session_retrying', sessionId, { attempt, backoffMs });
			await new Promise((resolve) => setTimeout(resolve, backoffMs));
		}
	}
}
