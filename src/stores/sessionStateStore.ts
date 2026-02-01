import type { SessionData } from '../types';

const SESSION_STATE_KEY = 'state' as const;

export async function loadSessionData(state: DurableObjectState): Promise<SessionData | null> {
	const data = await state.storage.get<SessionData>(SESSION_STATE_KEY);
	return data ?? null;
}

export async function saveSessionData(state: DurableObjectState, data: SessionData): Promise<void> {
	await state.storage.put(SESSION_STATE_KEY, data);
}

export async function clearSessionData(state: DurableObjectState): Promise<void> {
	await state.storage.deleteAll();
}
