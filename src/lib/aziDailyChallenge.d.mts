export type DailyChallenge =
  | {
      id: string;
      date: string;
      type: "review_mistake";
      sourceId: string;
      sourceTopicId: string | null;
      titleKey: string;
      descriptionKey: string;
      action: { type: "review_mistake"; mistakeId: string };
      status: "active";
    }
  | {
      id: string;
      date: string;
      type: "practice_topic";
      sourceId: string;
      titleKey: string;
      descriptionKey: string;
      questionCount: number;
      action: { type: "start_topic_practice"; topicId: string; questionCount: number };
      status: "active";
    }
  | {
      id: string;
      date: string;
      type: "practice_study_pack";
      sourceId: string;
      sourceTitle: string | null;
      quizId: string;
      titleKey: string;
      descriptionKey: string;
      questionCount: number;
      action: { type: "start_study_pack_practice"; studyPackId: string; quizId: string; questionCount: number };
      status: "active";
    }
  | {
      id: string;
      date: string;
      type: "unavailable";
      titleKey: string;
      descriptionKey: string;
      action: null;
      status: "unavailable";
    };

export function selectDailyChallenge(input?: {
  reviewableMistakes?: Array<{
    id?: string;
    topic_id?: string | null;
    is_reviewable?: boolean;
  }>;
  topics?: Array<{
    id?: string;
    is_available?: boolean;
    available_question_count?: number;
    document_id?: string;
    quiz_id?: string;
    title?: string;
  }>;
  studyPacks?: Array<{
    id?: string;
    status?: string;
    available_question_count?: number;
  }>;
  now?: Date | string;
  timeZone?: string;
  recentChallengeKeys?: string[];
  dismissedChallengeKeys?: string[];
  existingChallenge?: DailyChallenge | null;
  minimumPracticeQuestions?: number;
}): DailyChallenge;
