import { SELF, env, fetchMock, runInDurableObject } from 'cloudflare:test';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';

import type { ApiStartSessionResponseWithId, ApiSubmitAnswerResponse } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

type BrandId = string | number;

// -------------------- Outbound fetch safety --------------------
beforeAll(() => {
	// Enable outbound request mocking and block any real network calls
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

afterEach(() => {
	// If you add interceptors in any test, ensure they were all matched
	fetchMock.assertNoPendingInterceptors();
});

afterAll(() => {
	// Nothing required here; fetchMock is reset per test file by the runner.
});

// -------------------- Deterministic RNG (optional) --------------------
// Keep this if your question selection uses Math.random and you want stable tests.
// If your session IDs are generated using Math.random (not recommended), you may
// want to remove this block to avoid accidental coupling.
const ORIGINAL_RANDOM = Math.random;

function mulberry32(seed: number) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hash32(str: string) {
	// simple FNV-1a 32-bit
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

beforeEach(() => {
	const name = (expect as any).getState?.().currentTestName ?? 'seed';
	Math.random = mulberry32(hash32(String(name)));
});

afterEach(() => {
	Math.random = ORIGINAL_RANDOM;
});

// -------------------- HTTP helpers --------------------
async function startSession(): Promise<{ sessionId: string; data: ApiStartSessionResponseWithId }> {
	const response = await SELF.fetch('http://example.com/session/start', { method: 'GET' });
	expect(response.status).toBe(200);

	const body = (await response.json()) as ApiStartSessionResponseWithId;
	expect(body.sessionId).toBeTruthy();

	return { sessionId: body.sessionId, data: body };
}

async function restoreSession(
	sessionId: string,
): Promise<{ status: number; body: ApiStartSessionResponseWithId | { error: string; code?: string } }> {
	const response = await SELF.fetch('http://example.com/session/restore', {
		method: 'GET',
		headers: { session_id: sessionId },
	});
	const body = (await response.json()) as ApiStartSessionResponseWithId | { error: string; code?: string };
	return { status: response.status, body };
}

async function submitAnswer(
	sessionId: string,
	questionNumber: number,
	brandId: BrandId,
	timeTaken?: number,
): Promise<{ status: number; body: ApiSubmitAnswerResponse | { error: string; code?: string } }> {
	const response = await SELF.fetch('http://example.com/session/answer', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			session_id: sessionId,
		},
		// Intentionally not typed as AnswerRequest here, because your runtime may accept string IDs.
		body: JSON.stringify({ questionNumber, brandId, timeTaken }),
	});

	const body = (await response.json()) as ApiSubmitAnswerResponse | { error: string; code?: string };
	return { status: response.status, body };
}

async function endSession(sessionId: string): Promise<{ status: number; body: { message?: string; error?: string; code?: string } }> {
	const response = await SELF.fetch('http://example.com/session/end', {
		method: 'GET',
		headers: { session_id: sessionId },
	});
	const body = (await response.json()) as { message?: string; error?: string; code?: string };
	return { status: response.status, body };
}

// -------------------- Correctness helpers --------------------
function extractBrandKeyFromLogoUrl(url: string): string | null {
	// Matches /brands/<anything-not-slash-or-query>/...
	const m = url.match(/\/brands\/([^/?#]+)(?:[/?#]|$)/);
	return m ? decodeURIComponent(m[1]) : null;
}

function pickBrandId(value: unknown): BrandId | null {
	if (typeof value === 'string' && value.length > 0) return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	return null;
}

function deepScanForBrandId(obj: unknown, depth = 0): BrandId | null {
	if (!obj || typeof obj !== 'object') return null;
	if (depth > 5) return null;

	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		// Prefer fields that look like the “correct answer”
		if (/correct/i.test(k) && /brand/i.test(k) && /id/i.test(k)) {
			const id = pickBrandId(v);
			if (id != null) return id;
		}
		if (/^(brandId|brand_id|answerBrandId|answer_brand_id)$/i.test(k)) {
			const id = pickBrandId(v);
			if (id != null) return id;
		}
		if (/^brand$/i.test(k) && v && typeof v === 'object') {
			const id = pickBrandId((v as any).id);
			if (id != null) return id;
		}
	}

	// Recurse
	for (const v of Object.values(obj as Record<string, unknown>)) {
		const found = deepScanForBrandId(v, depth + 1);
		if (found != null) return found;
	}
	return null;
}

function findCorrectBrandIdInSessionData(sessionData: any, questionNumber: number): BrandId {
	const q =
		sessionData?.questions?.[questionNumber] ??
		sessionData?.quizQuestions?.[questionNumber] ??
		sessionData?.questionBank?.[questionNumber] ??
		sessionData?.currentQuestions?.[questionNumber];

	const candidates = [
		q?.correctBrandId,
		q?.brandId,
		q?.answer?.brandId,
		q?.brand?.id,
		sessionData?.answerKey?.[questionNumber],
		sessionData?.correctAnswers?.[questionNumber],
		sessionData?.correctBrandIds?.[questionNumber],
	];

	for (const c of candidates) {
		const id = pickBrandId(c);
		if (id != null) return id;
	}

	const deep = deepScanForBrandId(q ?? sessionData);
	if (deep != null) return deep;

	const keys = q && typeof q === 'object' ? Object.keys(q).join(', ') : '<none>';
	throw new Error(`Could not find correct brandId in stored session state for question ${questionNumber}. ` + `Question keys: ${keys}`);
}

function getSessionStub(sessionId: string) {
	// Your sessionId appears to be a DO id string (64 hex). If it’s actually a name, idFromName() will still work.
	const ns: any = env.SESSION;
	const id = typeof ns.idFromString === 'function' ? ns.idFromString(sessionId) : ns.idFromName(sessionId);

	return ns.get(id);
}

interface DoStateLike {
	storage: {
		get(key: string): Promise<unknown>;
	};
}

async function getCorrectBrandIdViaDurableObject(sessionId: string, questionNumber: number): Promise<BrandId> {
	// Cast stub to any to prevent deep type inference from the DO RPC stub type
	const stub = getSessionStub(sessionId) as any;

	return await runInDurableObject(stub, async (_instance: unknown, state: DoStateLike) => {
		// Avoid state.storage.get<any>() — the generic is where TS tends to explode
		const stored = await state.storage.get('state');

		if (!stored) {
			throw new Error(`No session state found in Durable Object storage under key "state". ` + `Did startSession persist sessionData?`);
		}

		// stored is unknown here; that’s fine for our “scan” extractor
		return findCorrectBrandIdInSessionData(stored as any, questionNumber);
	});
}

async function getCorrectAndWrongBrandIds(
	sessionId: string,
	start: ApiStartSessionResponseWithId,
	questionNumber: number,
): Promise<{ correctBrandId: BrandId; wrongBrandId: BrandId }> {
	const q0 = (start.questions as any)?.[questionNumber];
	const logoUrl: string | undefined = q0?.question?.logo ?? q0?.logo;

	if (!logoUrl) {
		throw new Error(`Unable to find logo URL for question ${questionNumber} in startSession response`);
	}

	const brands: Array<{ id: BrandId }> = start.brands as any;
	const brandIds = brands.map((b) => b.id);

	// 1) Try derive from URL (works if brands[].id matches the URL segment, e.g. UUID string)
	const token = extractBrandKeyFromLogoUrl(logoUrl);
	if (token != null) {
		const tokenMatch = brandIds.find((id) => String(id) === token);
		if (tokenMatch != null) {
			const wrong = brandIds.find((id) => String(id) !== String(tokenMatch));
			if (wrong == null) throw new Error('Could not select a wrong brandId (brands list too small?)');
			return { correctBrandId: tokenMatch, wrongBrandId: wrong };
		}
	}

	// 2) Fallback: inspect the stored session state inside the Durable Object
	const correct = await getCorrectBrandIdViaDurableObject(sessionId, questionNumber);

	const wrong = brandIds.find((id) => String(id) !== String(correct));
	if (wrong == null) throw new Error('Could not select a wrong brandId (brands list too small?)');

	return { correctBrandId: correct, wrongBrandId: wrong };
}

// -------------------- Tests --------------------
describe('Session API - Acceptance (deterministic & network-safe)', () => {
	it('starts a new session and returns brands + questions', async () => {
		const { sessionId, data } = await startSession();

		expect(sessionId).toBeTruthy();
		expect(typeof sessionId).toBe('string');

		expect(Array.isArray(data.brands)).toBe(true);
		expect(data.brands.length).toBe(89);

		expect(Array.isArray(data.questions)).toBe(true);
		expect(data.questions.length).toBe(15);

		const first = data.questions[0] as any;
		expect(first).toHaveProperty('question');
		expect(first.question).toHaveProperty('logo');
		expect(String(first.question.logo)).toMatch(/^http/);
		expect(String(first.question.logo)).toContain('/brands/');
	});

	it('restores an existing session and returns identical questions', async () => {
		const { sessionId, data: original } = await startSession();
		const restored = await restoreSession(sessionId);

		expect(restored.status).toBe(200);

		const body = restored.body as ApiStartSessionResponseWithId;
		expect(body.brands.length).toBe(89);
		expect(body.questions.length).toBe(15);

		expect(body.questions).toEqual(original.questions);
	});

	it('returns 400 when restoring without session_id header', async () => {
		const response = await SELF.fetch('http://example.com/session/restore', { method: 'GET' });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Missing session_id header' });
	});

	it('returns INVALID_SESSION_ID for a syntactically invalid session id', async () => {
		const { status, body } = await restoreSession('invalid-session-id');
		expect(status).toBe(400);
		expect((body as any).code).toBe(SessionErrorCode.INVALID_SESSION_ID);
	});

	it('accepts a guaranteed-correct answer and does not decrement lives', async () => {
		const { sessionId, data } = await startSession();
		const { correctBrandId } = await getCorrectAndWrongBrandIds(sessionId, data, 0);

		const { status, body } = await submitAnswer(sessionId, 0, correctBrandId, 2500);

		expect(status).toBe(200);
		const res = body as ApiSubmitAnswerResponse;

		expect(res.isCorrect).toBe(true);
		expect(typeof res.lives).toBe('number');
		expect(res.lives).toBeGreaterThan(0);

		expect(typeof res.score).toBe('number');
		expect(res).toHaveProperty('logo');
	});

	it('accepts a guaranteed-wrong answer, decrements lives, and allows retrying same question', async () => {
		const { sessionId, data } = await startSession();
		const { correctBrandId, wrongBrandId } = await getCorrectAndWrongBrandIds(sessionId, data, 0);

		const first = await submitAnswer(sessionId, 0, wrongBrandId, 1200);
		expect(first.status).toBe(200);

		const firstRes = first.body as ApiSubmitAnswerResponse;
		expect(firstRes.isCorrect).toBe(false);

		// Retry same question with the correct answer
		const second = await submitAnswer(sessionId, 0, correctBrandId, 900);
		expect(second.status).toBe(200);

		const secondRes = second.body as ApiSubmitAnswerResponse;
		expect(secondRes.isCorrect).toBe(true);

		// Lives shouldn't increase by answering correctly
		expect(secondRes.lives).toBeLessThanOrEqual(firstRes.lives);
	});

	it('returns GAME_OVER after losing all lives with wrong answers', async () => {
		const { sessionId, data } = await startSession();
		const { wrongBrandId } = await getCorrectAndWrongBrandIds(sessionId, data, 0);

		// Drive lives down with wrong answers until we either hit lives=0 or the API starts returning 409.
		let lives = 999;

		for (let i = 0; i < 10; i++) {
			const { status, body } = await submitAnswer(sessionId, 0, wrongBrandId, 500);

			if (status === 409) {
				expect((body as any).code).toBe(SessionErrorCode.GAME_OVER);
				return;
			}

			expect(status).toBe(200);
			lives = (body as ApiSubmitAnswerResponse).lives;
			if (lives === 0) break;
		}

		expect(lives).toBe(0);

		// One more wrong answer should now produce GAME_OVER
		const final = await submitAnswer(sessionId, 0, wrongBrandId, 500);
		expect(final.status).toBe(409);
		expect((final.body as any).code).toBe(SessionErrorCode.GAME_OVER);
	});

	it('ends a session and then restore returns SESSION_NOT_FOUND', async () => {
		const { sessionId } = await startSession();

		const ended = await endSession(sessionId);
		expect(ended.status).toBe(200);
		expect(ended.body.message).toBe('Session ended and memory cleared');

		const restored = await restoreSession(sessionId);
		expect(restored.status).toBe(404);
		expect((restored.body as any).code).toBe(SessionErrorCode.SESSION_NOT_FOUND);
	});

	it('handles concurrent session starts (unique ids)', async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => startSession()));
		const ids = results.map((r) => r.sessionId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('includes CORS headers on responses', async () => {
		const response = await SELF.fetch('http://example.com/session/start', { method: 'GET' });
		expect(response.headers.has('Access-Control-Allow-Origin')).toBe(true);
	});

	it('handles OPTIONS preflight', async () => {
		const response = await SELF.fetch('http://example.com/session/start', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:3000',
				'Access-Control-Request-Method': 'GET',
			},
		});
		expect([200, 204]).toContain(response.status);
	});
});
