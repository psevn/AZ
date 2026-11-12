export const QUIZ_LIMITS: Readonly<{
  minQuestions: number;
  maxQuestions: number;
  maxPages: number;
  maxCharacters: number;
  maxPageCharacters: number;
}>;

export type QuizSourcePage = { page_no: number; text: string };
export type GeneratedQuizQuestion = {
  prompt: string;
  choices: string[];
  correct_index: number;
  source_page: number;
  topic: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
};

export function buildQuizInput(input: {
  language: "ar" | "en";
  questionCount: number;
  topic: string;
  pages: QuizSourcePage[];
}): Array<{ role: "developer" | "user"; content: string }>;

export function validateGeneratedQuestions(
  value: unknown,
  allowedPageNumbers: number[],
  expectedCount: number,
): GeneratedQuizQuestion[];

export function makeOpenAIRequest(input: {
  model: string;
  language: "ar" | "en";
  questionCount: number;
  topic: string;
  pages: QuizSourcePage[];
  maxOutputTokens?: number;
}): Record<string, unknown>;

export function extractResponsesOutput(response: unknown): unknown;
