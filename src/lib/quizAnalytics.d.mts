export interface AnswerRow { topic: string; isCorrect: boolean; answeredAt: string | Date; subjectId?: string | null }
export interface WeakTopic { subjectId: string | null; topic: string; answered: number; correct: number; accuracy: number; trend: "improving" | "declining" | "flat" | "unknown"; lastAnsweredAt: string }
export interface SubjectAccuracy { subjectId: string | null; answered: number; correct: number; accuracy: number }
export interface Streak { current: number; longest: number; restDayUsed: boolean; activeToday: boolean }
export const WEAK_TOPIC_RULES: Readonly<{ windowSize: number; minAnswers: number; weakBelowAccuracy: number }>;
export function dateKeyInZone(value: string | Date, timeZone?: string): string | null;
export function findWeakTopics(answers?: AnswerRow[], rules?: Partial<typeof WEAK_TOPIC_RULES>): WeakTopic[];
export function subjectAccuracy(answers?: AnswerRow[]): SubjectAccuracy[];
export function computeStreak(activityDates?: Array<string | Date>, options?: { now?: Date; timeZone?: string }): Streak;
