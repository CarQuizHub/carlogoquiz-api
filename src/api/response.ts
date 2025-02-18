import { CORS_HEADERS } from '../config/constants';

export function createJsonResponse<T>(data: T, status: number, headers?: Record<string, string>): Response {
	const responseHeaders = new Headers({
		...CORS_HEADERS,
		...headers,
	});
	return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}
