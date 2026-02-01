export const EXPECTED_BRAND_COUNT = 89;
export const EXPECTED_QUESTION_COUNT = 15;

import { env } from 'cloudflare:test';
import { runInDurableObject } from 'cloudflare:test';
import { expect } from 'vitest';

import { SESSION_STATE_KEY, type AnswerRequest, type SessionData } from '../../src/types';
import { QuizApi } from '../../src/services/quizApi';

export function getApi(): QuizApi {
	return new QuizApi(env);
}

export function createAnswerRequest(questionNumber: number, brandId: number, timeTaken: number | null = null): AnswerRequest {
	return { questionNumber, brandId, timeTaken };
}

export type SessionStub = ReturnType<(typeof env.SESSION)['get']>;
export function getSessionStub(sessionId: string): SessionStub {
	const id = env.SESSION.idFromString(sessionId);
	return env.SESSION.get(id);
}

export async function getSessionState(sessionId: string): Promise<SessionData | null> {
	const stub = getSessionStub(sessionId);
	return await runInDurableObject(stub, async (_instance, state) => {
		const data = await state.storage.get(SESSION_STATE_KEY);
		return (data as SessionData) ?? null;
	});
}

export async function getSessionStateOrFail(sessionId: string): Promise<SessionData> {
	const sessionState = await getSessionState(sessionId);
	expect(sessionState, `Expected session state to exist for session ${sessionId}`).not.toBeNull();
	return sessionState as SessionData;
}

export async function getCorrectBrandId(sessionId: string, questionNumber: number): Promise<number> {
	const sessionState = await getSessionStateOrFail(sessionId);
	return sessionState.questions[questionNumber].brandId;
}
