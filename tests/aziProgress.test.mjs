import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLearningProgress } from "../src/lib/aziProgress.mjs";

const now = "2026-11-11T09:00:00.000Z"; // 12:00 in Qatar

test("counts only completed, non-future learning actions", () => {
  const result = analyzeLearningProgress({
    now,
    quizAttempts: [
      { id: "q1", status: "completed", completed_at: "2026-11-09T10:00:00Z" },
      { id: "q1", status: "completed", completed_at: "2026-11-09T10:00:00Z" },
      { id: "unfinished", status: "in_progress", completed_at: "2026-11-10T10:00:00Z" },
      { id: "future", status: "completed", completed_at: "2026-11-12T10:00:00Z" },
    ],
    focusSessions: [
      { id: "f1", started_at: "2026-11-10T08:00:00Z", ended_at: "2026-11-10T08:25:00Z" },
      { id: "bad", started_at: "2026-11-10T09:00:00Z", ended_at: "2026-11-10T08:00:00Z" },
      { id: "future-focus", started_at: "2026-11-12T08:00:00Z", ended_at: "2026-11-12T08:25:00Z" },
    ],
    mistakeReviews: [
      { id: "m1", reviewed_at: "2026-11-11T08:00:00Z" },
      { id: "future-review", reviewed_at: "2026-11-12T08:00:00Z" },
    ],
  });

  assert.equal(result.activity.completedQuizAttempts, 1);
  assert.equal(result.activity.completedFocusSessions, 1);
  assert.equal(result.activity.reviewedMistakes, 1);
  assert.equal(result.activity.studyDaysLastSevenDays, 3);
});

test("streaks use Qatar-local calendar days and allow today or yesterday as the endpoint", () => {
  const result = analyzeLearningProgress({
    now,
    quizAttempts: [
      { id: "a", status: "completed", completed_at: "2026-11-08T21:30:00Z" }, // Nov 9 Qatar
      { id: "b", status: "completed", completed_at: "2026-11-09T21:30:00Z" }, // Nov 10 Qatar
      { id: "c", status: "completed", completed_at: "2026-11-10T21:30:00Z" }, // Nov 11 Qatar
    ],
  });

  assert.equal(result.activity.currentStreak, 3);
  assert.equal(result.activity.longestStreak, 3);
  assert.equal(result.window.endDate, "2026-11-11");
});

test("does not label a topic before the minimum answer sample", () => {
  const result = analyzeLearningProgress({
    now,
    quizAttempts: [{
      id: "q1",
      status: "completed",
      completed_at: "2026-11-10T10:00:00Z",
      answers: [
        { id: "a1", topic_id: "algebra", is_correct: false, submitted_at: "2026-11-10T09:00:00Z" },
        { id: "a2", topic_id: "algebra", is_correct: false, submitted_at: "2026-11-10T09:01:00Z" },
      ],
    }],
  });

  assert.deepEqual(result.topics, [{
    topicId: "algebra",
    sampleSize: 2,
    correctAnswers: 0,
    accuracyPercent: null,
    status: "insufficient_data",
  }]);
});

test("recommends review only below 60 percent with at least three distinct answers", () => {
  const result = analyzeLearningProgress({
    now,
    quizAttempts: [{
      id: "q1",
      status: "completed",
      completed_at: "2026-11-10T10:00:00Z",
      answers: [
        { id: "a1", topic_id: "biology", is_correct: false, submitted_at: "2026-11-10T09:00:00Z" },
        { id: "a2", topic_id: "biology", is_correct: true, submitted_at: "2026-11-10T09:01:00Z" },
        { id: "a3", topic_id: "biology", is_correct: false, submitted_at: "2026-11-10T09:02:00Z" },
        { id: "a3", topic_id: "biology", is_correct: true, submitted_at: "2026-11-10T09:03:00Z" },
      ],
    }],
  });

  assert.deepEqual(result.topics, [{
    topicId: "biology",
    sampleSize: 3,
    correctAnswers: 1,
    accuracyPercent: 33.3,
    status: "review_recommended",
  }]);
});

test("ignores duplicate answer IDs, answers after completion, and answers outside the window", () => {
  const result = analyzeLearningProgress({
    now,
    quizAttempts: [{
      id: "q1",
      status: "completed",
      completed_at: "2026-11-10T10:00:00Z",
      answers: [
        { id: "a1", topic_id: "chemistry", is_correct: true, submitted_at: "2026-11-10T09:00:00Z" },
        { id: "a1", topic_id: "chemistry", is_correct: false, submitted_at: "2026-11-10T09:01:00Z" },
        { id: "future-answer", topic_id: "chemistry", is_correct: false, submitted_at: "2026-11-10T11:00:00Z" },
        { id: "old-answer", topic_id: "chemistry", is_correct: false, submitted_at: "2026-11-03T08:00:00Z" },
      ],
    }],
  });

  assert.equal(result.topics[0].sampleSize, 1);
  assert.equal(result.topics[0].accuracyPercent, null);
  assert.equal(result.topics[0].status, "insufficient_data");
});

test("rejects invalid clock and invalid sample threshold", () => {
  assert.throws(() => analyzeLearningProgress({ now: "bad" }), /valid date/);
  assert.throws(() => analyzeLearningProgress({ now, minTopicAnswers: 0 }), /positive integer/);
});
