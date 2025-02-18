export function createJsonResponse<T>(data: T, status: number, headers?: Record<string, string>): Response {
	const responseHeaders = new Headers({
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*', //update to site domains
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		...headers,
	});
	return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}
