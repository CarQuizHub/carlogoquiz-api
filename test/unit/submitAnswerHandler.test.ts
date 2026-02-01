import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/utils', async () => {
	const actual = await vi.importActual<typeof import('../../src/utils')>('../../src/utils');
	return {
		...actual,
		generateLogoUrl: vi.fn((mediaId: string, isHidden: boolean, baseUrl: string) => `${baseUrl}/${mediaId}${isHidden ? '_hidden' : ''}`),
		calculateLogoQuizScore: vi.fn(() => 10),
		calculateTimeTakenBonus: vi.fn(() => 5),
	};
});

import { handleSubmitAnswer } from '../../src/handlers/submitAnswerHandler';
import { calculateTimeTakenBonus } from '../../src/utils';
import type { SessionContext } from '../../src/types/session';
import type { AnswerRequest, StoredQuestion } from '../../src/types';
import { SessionErrorCode } from '../../src/types';

const DO_ID = 'do-id-123';
const MEDIA_BASE_URL = 'https://cdn.example.com';

describe('handleSubmitAnswer', () => {
	let fakeSession: SessionContext & {
		save: ReturnType<typeof vi.fn>;
		clear: ReturnType<typeof vi.fn>;
	};
	let mockQuestions: StoredQuestion[];

	beforeEach(() => {
		vi.clearAllMocks();

		mockQuestions = [
			{ logo: 'logo1.png', brandId: 1, difficulty: 2, mediaId: 'media1' },
			{ logo: 'logo2.png', brandId: 2, difficulty: 3, mediaId: 'media2' },
		];

		fakeSession = {
			sessionId: DO_ID,
			sessionData: {
				score: 0,
				lives: 3,
				currentQuestion: 0,
				questions: mockQuestions,
			},
			save: vi.fn().mockResolvedValue(undefined),
			clear: vi.fn().mockImplementation(async () => {
				fakeSession.sessionData = null;
			}),
		};
	});

	describe('correct answers', () => {
		it('processes correct answer and updates session', async () => {
			const answerData: AnswerRequest = { questionNumber: 0, brandId: 1, timeTaken: null };

			const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.isCorrect).toBe(true);
				expect(result.data.lives).toBe(3);
				expect(result.data.score).toBe(10);
				expect(result.data.logo).toBe('https://cdn.example.com/media1');
			}

			expect(fakeSession.sessionData?.currentQuestion).toBe(1);
			expect(fakeSession.save).toHaveBeenCalledTimes(1);
			expect(fakeSession.clear).not.toHaveBeenCalled();
		});

		it('completes game on final correct answer and clears session', async () => {
			// Answer first question
			await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			// Answer final question
			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 1, brandId: 2, timeTaken: 500 }, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.isCorrect).toBe(true);
				expect(result.data.score).toBe(25); // 10 + 10 + 5 bonus
			}

			expect(fakeSession.clear).toHaveBeenCalledTimes(1);
			expect(fakeSession.sessionData).toBeNull();
			expect(calculateTimeTakenBonus).toHaveBeenCalledWith(500);
		});

		it('does not apply time bonus when timeTaken is null on final question', async () => {
			await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 1, brandId: 2, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.score).toBe(20); // No bonus
			}

			expect(calculateTimeTakenBonus).not.toHaveBeenCalled();
		});

		it('does not apply time bonus when timeTaken is 0 on final question', async () => {
			await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 1, brandId: 2, timeTaken: 0 }, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.score).toBe(20); // No bonus
			}

			expect(calculateTimeTakenBonus).not.toHaveBeenCalled();
		});
	});

	describe('incorrect answers', () => {
		it('processes incorrect answer and decrements lives', async () => {
			const answerData: AnswerRequest = { questionNumber: 0, brandId: 999, timeTaken: null };

			const result = await handleSubmitAnswer(fakeSession, answerData, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.isCorrect).toBe(false);
				expect(result.data.lives).toBe(2);
				expect(result.data.score).toBe(0);
				expect(result.data.logo).toBe('https://cdn.example.com/media1_hidden');
			}

			expect(fakeSession.sessionData?.currentQuestion).toBe(0); // Does not advance
			expect(fakeSession.save).toHaveBeenCalledTimes(1);
		});

		it('drops lives to 0 but does not clear session', async () => {
			fakeSession.sessionData = {
				score: 0,
				lives: 1,
				currentQuestion: 0,
				questions: mockQuestions,
			};

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 999, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.lives).toBe(0);
				expect(result.data.isCorrect).toBe(false);
			}

			expect(fakeSession.sessionData).not.toBeNull();
			expect(fakeSession.clear).not.toHaveBeenCalled();
		});

		it('returns GAME_OVER on subsequent submit after lives reach 0', async () => {
			fakeSession.sessionData = {
				score: 0,
				lives: 0,
				currentQuestion: 0,
				questions: mockQuestions,
			};

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.GAME_OVER);
				expect(result.error.message).toBe('Game over');
			}
		});
	});

	describe('validation errors', () => {
		it('returns NO_ACTIVE_SESSION when sessionData is null', async () => {
			fakeSession.sessionData = null;

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.NO_ACTIVE_SESSION);
				expect(result.error.message).toBe('No active session');
			}
		});

		it('returns INVALID_INPUT_FORMAT when questionNumber is missing', async () => {
			const result = await handleSubmitAnswer(fakeSession, { brandId: 1 } as AnswerRequest, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
				expect(result.error.message).toBe('Invalid input format');
			}
		});

		it('returns INVALID_INPUT_FORMAT when brandId is missing', async () => {
			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 0 } as AnswerRequest, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
				expect(result.error.message).toBe('Invalid input format');
			}
		});

		it('returns INVALID_INPUT_FORMAT for empty object', async () => {
			const result = await handleSubmitAnswer(fakeSession, {} as AnswerRequest, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_INPUT_FORMAT);
			}
		});

		it('returns INVALID_QUESTION_NUMBER when answering wrong question', async () => {
			const result = await handleSubmitAnswer(
				fakeSession,
				{ questionNumber: 1, brandId: 2, timeTaken: null }, // currentQuestion is 0
				MEDIA_BASE_URL,
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
				expect(result.error.message).toBe('Invalid question number');
			}
		});

		it('returns INVALID_QUESTION_NUMBER for negative question number', async () => {
			const result = await handleSubmitAnswer(fakeSession, { questionNumber: -1, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
			}
		});

		it('returns INVALID_QUESTION_NUMBER for out-of-bounds question', async () => {
			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 99, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INVALID_QUESTION_NUMBER);
			}
		});
	});

	describe('error handling', () => {
		it('returns INTERNAL_ERROR when save() throws', async () => {
			fakeSession.save.mockRejectedValue(new Error('Storage failure'));

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
				expect(result.error.message).toBe('Failed to submit answer');
			}
		});

		it('returns INTERNAL_ERROR when clear() throws on game completion', async () => {
			await handleSubmitAnswer(fakeSession, { questionNumber: 0, brandId: 1, timeTaken: null }, MEDIA_BASE_URL);

			fakeSession.clear.mockRejectedValue(new Error('Clear failure'));

			const result = await handleSubmitAnswer(fakeSession, { questionNumber: 1, brandId: 2, timeTaken: 500 }, MEDIA_BASE_URL);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(SessionErrorCode.INTERNAL_ERROR);
				expect(result.error.message).toBe('Failed to submit answer');
			}
		});
	});
});
