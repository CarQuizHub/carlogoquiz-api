import { DurableObject } from 'cloudflare:workers';

export interface Env {
	DB: D1Database;
	SESSION_DO: DurableObjectNamespace;
}

interface QuestionTemplate {
	question_id: number;
	template_text: string;
}

interface AnswerOption {
	answer_id: number;
	answer_text: string;
}

interface SessionData {
	score: number;
	currentQuestion: { question_id: number; correct_answer_id: number } | null;
}

export class Session extends DurableObject {
	public env: Env;
	private state: DurableObjectState;
	private sessionData: SessionData;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
		this.sessionData = { score: 0, currentQuestion: null };
	}

	async fetch(request: Request) {
		const url = new URL(request.url);
		const difficulty = request.headers.get('Difficulty');

		if (url.pathname === '/session/start') {
			return this.startSession();
		} else if (url.pathname === '/session/question') {
			if (!difficulty) return new Response('Missing difficulty parameter', { status: 400 });
			return await this.generateQuestion(parseInt(difficulty));
		} else if (url.pathname === '/session/answer') {
			return await this.validateAnswer(request);
		}

		return new Response('Not Found', { status: 404 });
	}

	async startSession() {
		this.sessionData = { score: 0, currentQuestion: null };
		return new Response(JSON.stringify({ message: 'Session started', score: this.sessionData.score }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	async generateQuestion(difficulty: number) {
		const query = `
            WITH selected_template AS (
                SELECT qt.id AS question_id, qt.template_text
                FROM question_templates qt
                JOIN question_template_difficulties qtd ON qt.id = qtd.question_template_id
                WHERE qtd.difficulty = ?
                ORDER BY RANDOM()
                LIMIT 1
            ),
            correct_answer AS (
                SELECT id AS answer_id, name AS answer_text
                FROM brands
                WHERE difficulty = (SELECT expected_options FROM selected_template)
                ORDER BY RANDOM()
                LIMIT 1
            ),
            distractors AS (
                SELECT id AS answer_id, name AS answer_text
                FROM brands
                WHERE difficulty = (SELECT expected_options FROM selected_template)
                AND id NOT IN (SELECT answer_id FROM correct_answer)
                ORDER BY RANDOM()
                LIMIT (SELECT expected_options - 1 FROM selected_template)
            )
            SELECT * FROM selected_template
            UNION ALL
            SELECT * FROM correct_answer
            UNION ALL
            SELECT * FROM distractors;
        `;

		const { results }: { results: (QuestionTemplate & AnswerOption)[] } = await this.env.DB.prepare(query).bind(difficulty).all();

		if (!results.length) return new Response(JSON.stringify({ error: 'No questions available' }), { status: 400 });

		const template = results[0] as QuestionTemplate;
		const answers = results.slice(1).map((row) => ({
			id: row.answer_id,
			text: row.answer_text,
		}));

		answers.sort(() => Math.random() - 0.5);

		const correctAnswer = answers.find((answer) => answer.id === results[1].answer_id);
		this.sessionData.currentQuestion = { question_id: template.question_id, correct_answer_id: correctAnswer!.id };

		return new Response(
			JSON.stringify({
				question_id: template.question_id,
				question_text: template.template_text,
				answers,
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}

	async validateAnswer(request: Request) {
		const body: { selected_answer_id: number } = await request.json();

		if (!this.sessionData.currentQuestion) {
			return new Response(JSON.stringify({ error: 'No active question' }), { status: 400 });
		}

		const isCorrect = this.sessionData.currentQuestion.correct_answer_id === body.selected_answer_id;

		if (isCorrect) {
			this.sessionData.score += 1;
		}

		return new Response(
			JSON.stringify({
				is_correct: isCorrect,
				new_score: this.sessionData.score,
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
}
