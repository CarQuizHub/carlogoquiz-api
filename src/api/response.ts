export function createJsonResponse<T>(data: T, status: number, headers?: Record<string, string>): Response {
	const responseHeaders = new Headers({
		'Content-Type': 'application/json; charset=utf-8',
		...headers,
	});
	return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}
