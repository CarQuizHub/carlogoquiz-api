export function logInfo(event: string, sessionId: string = 'unknown', additionalData: Record<string, unknown> = {}): void {
	console.log({
		timestamp: new Date().toISOString(),
		level: 'info',
		event,
		sessionId,
		...additionalData,
	});
}

export function logWarning(event: string, sessionId: string, additionalData: Record<string, unknown> = {}): void {
	console.warn({
		timestamp: new Date().toISOString(),
		level: 'warn',
		event,
		sessionId,
		...additionalData,
	});
}

export function logError(event: string, sessionId: string = 'unknown', error: unknown): void {
	console.error({
		timestamp: new Date().toISOString(),
		level: 'error',
		event,
		sessionId,
		error: error instanceof Error ? error.message : 'Unknown error',
		stack: error instanceof Error ? error.stack : undefined, // Include stack trace for easier debugging
	});
}
