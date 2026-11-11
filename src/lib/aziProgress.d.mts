export type LearningQuizAnswer = {
  id?: string;
  topic_id?: string | null;
  is_correct?: boolean;
  submitted_at?: string | null;
};

export type LearningQuizAttempt = {
  id?: string;
  status?: string | null;
  completed_at?: string | null;
  answers?: LearningQuizAnswer[];
};

export type LearningFocusSession = {
  id?: string;
  started_at?: string | null;
  ended_at?: string | null;
};

export type LearningMistakeReview = {
  id?: string;
  reviewed_at?: string | null;
};

export type LearningTopicProgress = {
  topicId: string;
  sampleSize: number;
  correctAnswers: number;
  accuracyPercent: number | null;
  status: "insufficient_data" | "review_recommended" | "on_track";
};

export type LearningProgressMetrics = {
  asOf: string;
  timeZone: string;
  window: { startDate: string; endDate: string };
  activity: {
    studyDays: number;
    currentStreak: number;
    longestStreak: number;
    completedQuizAttempts: number;
    completedFocusSessions: number;
    reviewedMistakes: number;
  };
  topics: LearningTopicProgress[];
};

export function analyzeLearningProgress(input?: {
  quizAttempts?: LearningQuizAttempt[];
  focusSessions?: LearningFocusSession[];
  mistakeReviews?: LearningMistakeReview[];
  now?: Date | string;
  timeZone?: string;
  minTopicAnswers?: number;
}): LearningProgressMetrics;
