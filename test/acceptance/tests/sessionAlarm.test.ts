import { describe, it, expect } from 'vitest';
import { runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';

import { getApi, getSessionStub, getSessionState, type SessionStub } from '../testHelper';
import { SESSION_TTL_MS } from '../../../src/types';

describe('Session Durable Object alarms', () => {
	it('schedules an expiration alarm on startSession and clears state when the alarm runs', async () => {
		const before = Date.now();

		const start = await getApi().startSession();
		expect(start.success).toBe(true);
		if (!start.success) return;

		const sessionId = start.data.sessionId;
		const stub: SessionStub = getSessionStub(sessionId);

		try {
			const after = Date.now();

			const alarmAt = await runInDurableObject(stub, async (_instance, state) => {
				return await state.storage.getAlarm();
			});

			expect(alarmAt).not.toBeNull();

			const toleranceMs = 5_000;
			expect(alarmAt).toBeGreaterThanOrEqual(before + SESSION_TTL_MS - toleranceMs);
			expect(alarmAt).toBeLessThanOrEqual(after + SESSION_TTL_MS + toleranceMs);

			expect(await getSessionState(sessionId)).not.toBeNull();

			const alarmRan = await runDurableObjectAlarm(stub);
			expect(alarmRan).toBe(true);

			expect(await getSessionState(sessionId)).toBeNull();

			const alarmAtAfter = await runInDurableObject(stub, async (_instance, state) => {
				return await state.storage.getAlarm();
			});
			expect(alarmAtAfter).toBeNull();

			const alarmRanAgain = await runDurableObjectAlarm(stub);
			expect(alarmRanAgain).toBe(false);
		} finally {
			await runInDurableObject(stub, async (_instance, state) => {
				await state.storage.deleteAlarm();
			});
		}
	});
});
