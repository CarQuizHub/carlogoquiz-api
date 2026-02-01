import { describe, it, expect } from 'vitest';

import { getApi } from './../testHelper';

describe('concurrent operations', () => {
	it('handles concurrent session starts', async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => getApi().startSession()));

		const successfulResults = results.filter((r) => r.success);
		expect(successfulResults).toHaveLength(5);

		const sessionIds = successfulResults.map((r) => (r.success ? r.data.sessionId : null));
		expect(new Set(sessionIds).size).toBe(5);
	});
});
