import { fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, beforeEach, expect } from 'vitest';

const g = globalThis as unknown as { __FETCHMOCK_ACTIVE?: boolean };
const ORIGINAL_RANDOM = Math.random;

beforeAll(() => {
	if (!g.__FETCHMOCK_ACTIVE) {
		fetchMock.activate();
		fetchMock.disableNetConnect();
		g.__FETCHMOCK_ACTIVE = true;
	}
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
});

function mulberry32(seed: number) {
	return function (): number {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hash32(str: string): number {
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
