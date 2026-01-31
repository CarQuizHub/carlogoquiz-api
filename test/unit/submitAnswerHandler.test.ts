import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSubmitAnswer } from '../../src/handlers/submitAnswerHandler';
import type { SessionData, Bindings, AnswerRequest } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

// ---- OPTION A: keep your existing mocks (works if barrel re-exports and vitest resolves it)
// If these mocks don't intercept calls, use OPTION B below instead.
vi.mock('../../src/utils/logoUtils', () => ({
  generateLogoUrl: vi.fn((mediaId: string, incorrect: boolean, baseUrl: string) =>
    `${baseUrl}/${mediaId}${incorrect ? '_wrong' : ''}`
  ),
  calculateLogoQuizScore: vi.fn(() => 10),
}));

vi.mock('../../src/utils/questionUtils', () => ({
  calculateTimeTakenBonus: vi.fn(() => 5),
}));

/*
// ---- OPTION B: If your handler imports from '../../src/utils' barrel and OPTION A fails, use this instead.
// vi.mock('../../src/utils', async () => {
//   const actual = await vi.importActual<any>('../../src/utils');
//   return {
//     ...actual,
//     generateLogoUrl: vi.fn((mediaId: string, incorrect: boolean, baseUrl: string) =>
//       `${baseUrl}/${mediaId}${incorrect ? '_wrong' : ''}`
//     ),
//     calculateLogoQuizScore: vi.fn(() => 10),
//     calculateTimeTakenBonus: vi.fn(() => 5),
//   };
// });
*/

import { calculateTimeTakenBonus } from '../../src/utils/questionUtils';

const DO_ID = 'do-id-123';
const MEDIA_BASE_URL = 'https://cdn.example.com';

describe('handleSubmitAnswer', () => {
  let fakeSession: any;
  let fakeEnv: Bindings;

  beforeEach(() => {
    vi.clearAllMocks();

    fakeEnv = {
      MEDIA_BASE_URL,
      PRODUCTION: false,
    } as any;

    fakeSession = {
      env: fakeEnv,
      sessionData: {
        score: 0,
        lives: 3,
        currentQuestion: 0,
        questions: {
          0: { logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
          1: { logo: 'logo2.png', brandId: 2, difficulty: 3, mediaId: 'media2' },
        },
      } as SessionData,
      state: {
        id: { toString: () => DO_ID },
        storage: {
          put: vi.fn().mockResolvedValue(undefined),
          deleteAll: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any;
  });

  it('processes a correct answer and updates session (stores under key "state")', async () => {
    const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: null };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        isCorrect: true,
        lives: 3,
        score: 10,
        logo: 'https://cdn.example.com/media1',
      });
    }

    expect(fakeSession.state.storage.put).toHaveBeenCalledWith(
      'state',
      expect.any(Object),
    );
    expect(fakeSession.state.storage.deleteAll).not.toHaveBeenCalled();
  });

  it('processes an incorrect answer and updates session (stores under key "state")', async () => {
    const answerData: AnswerRequest = { questionNumber: 0, brandId: 2, timeTaken: 5 };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        isCorrect: false,
        lives: 2,
        score: 0,
        logo: 'https://cdn.example.com/media1_wrong',
      });
    }

    expect(fakeSession.state.storage.put).toHaveBeenCalledWith('state', expect.any(Object));
    expect(fakeSession.state.storage.deleteAll).not.toHaveBeenCalled();
  });

  it('completes session when final question is answered correctly (applies bonus + clears storage)', async () => {
    // Answer the first question correctly
    const answerData1: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
    const result1 = await handleSubmitAnswer(fakeSession, answerData1, MEDIA_BASE_URL);

    expect(result1.success).toBe(true);
    expect(fakeSession.sessionData.currentQuestion).toBe(1);

    // Answer the final question correctly
    const answerData2: AnswerRequest = { questionNumber: 1, brandId: 2, timeTaken: 5 };
    const result2 = await handleSubmitAnswer(fakeSession, answerData2, MEDIA_BASE_URL);

    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.data).toEqual({
        isCorrect: true,
        lives: 3,
        score: 25, // 10 + 10 + 5 bonus
        logo: 'https://cdn.example.com/media2',
      });
    }

    expect(fakeSession.state.storage.deleteAll).toHaveBeenCalled();
    expect(fakeSession.sessionData).toBeNull();
    expect(calculateTimeTakenBonus).toHaveBeenCalledWith(5);
  });

  it('returns an error when no active session exists', async () => {
    fakeSession.sessionData = null;

    const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
      expect(result.error.message).toBe('No active session');
    }
  });

  it('returns an error when the game is already over (lives <= 0 before submit)', async () => {
    fakeSession.sessionData.lives = 0;

    const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: 5 };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(SessionErrorCode.GAME_OVER);
      expect(result.error.message).toBe('Game over');
    }
  });

  it('returns an error when request format is invalid', async () => {
    const answerData = {} as AnswerRequest;
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
      expect(result.error.message).toBe('Invalid input format');
    }
  });

  it('returns an error when answering an invalid question (wrong currentQuestion)', async () => {
    // currentQuestion is 0, but we try to answer 1
    const answerData: AnswerRequest = { questionNumber: 1, brandId: 2, timeTaken: 5 };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
      expect(result.error.message).toBe('Invalid question number');
    }
  });

  it('drops lives to 0 on incorrect answer but does not auto-clear session (current behavior)', async () => {
    // Set up so a single wrong answer ends lives
    fakeSession.sessionData.lives = 1;

    const answerData: AnswerRequest = { questionNumber: 0, brandId: 2, timeTaken: null };
    const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lives).toBe(0);
      expect(result.data.isCorrect).toBe(false);
    }

    // With your current handler logic, it persists state even at 0 lives
    expect(fakeSession.state.storage.put).toHaveBeenCalledWith('state', expect.any(Object));
    expect(fakeSession.state.storage.deleteAll).not.toHaveBeenCalled();
    expect(fakeSession.sessionData).not.toBeNull();

    // Next attempt should return GAME_OVER
    const next = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);
    expect(next.success).toBe(false);
    if (!next.success) {
      expect(next.error.code).toBe(SessionErrorCode.GAME_OVER);
    }
  });
});
