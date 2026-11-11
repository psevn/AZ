import test from "node:test";
import assert from "node:assert/strict";
import { selectDailyChallenge } from "../src/lib/aziDailyChallenge.mjs";

const now = "2026-11-11T09:00:00.000Z"; // 12:00 in Qatar

test("prioritizes an explicitly reviewable mistake over practice suggestions", () => {
  const result = selectDailyChallenge({
    now,
    reviewableMistakes: [
      { id: "m2", topic_id: "biology", is_reviewable: true },
      { id: "m1", topic_id: "chemistry", is_reviewable: true },
    ],
    topics: [{ id: "math", is_available: true, available_question_count: 8 }],
    studyPacks: [{ id: "pack-1", status: "ready", available_question_count: 10 }],
  });

  assert.equal(result.type, "review_mistake");
  assert.equal(result.sourceId, "m1");
  assert.deepEqual(result.action, { type: "review_mistake", mistakeId: "m1" });
});

test("selects an available topic when no reviewable mistakes exist", () => {
  const result = selectDailyChallenge({
    now,
    topics: [
      { id: "topic-b", is_available: true, available_question_count: 5 },
      { id: "topic-a", is_available: true, available_question_count: 5 },
    ],
    studyPacks: [{ id: "pack-1", status: "ready", available_question_count: 9 }],
  });

  assert.equal(result.type, "practice_topic");
  assert.equal(result.sourceId, "topic-a");
  assert.equal(result.questionCount, 5);
});

test("falls back to a ready Study Pack when no topic is available", () => {
  const result = selectDailyChallenge({
    now,
    topics: [{ id: "topic", is_available: false, available_question_count: 10 }],
    studyPacks: [
      { id: "processing", status: "processing", available_question_count: 8 },
      { id: "ready", status: "ready", available_question_count: 5 },
    ],
  });

  assert.equal(result.type, "practice_study_pack");
  assert.equal(result.sourceId, "ready");
});

test("does not select unavailable, undersized, or non-reviewable sources", () => {
  const result = selectDailyChallenge({
    now,
    reviewableMistakes: [{ id: "m1", is_reviewable: false }],
    topics: [{ id: "topic", is_available: true, available_question_count: 4 }],
    studyPacks: [{ id: "pack", status: "deleted", available_question_count: 20 }],
  });

  assert.equal(result.type, "unavailable");
  assert.equal(result.action, null);
});

test("does not repeat recently selected or dismissed sources", () => {
  const result = selectDailyChallenge({
    now,
    reviewableMistakes: [{ id: "m1", is_reviewable: true }],
    topics: [{ id: "topic", is_available: true, available_question_count: 5 }],
    recentChallengeKeys: ["review_mistake:m1"],
    dismissedChallengeKeys: ["practice_topic:topic"],
  });

  assert.equal(result.type, "unavailable");
});

test("returns an already active challenge for the same local day", () => {
  const existingChallenge = {
    id: "existing",
    date: "2026-11-11",
    type: "practice_topic",
    sourceId: "old-topic",
    titleKey: "title",
    descriptionKey: "description",
    questionCount: 5,
    action: { type: "start_topic_practice", topicId: "old-topic", questionCount: 5 },
    status: "active",
  };

  const result = selectDailyChallenge({
    now,
    existingChallenge,
    reviewableMistakes: [{ id: "new-mistake", is_reviewable: true }],
  });

  assert.equal(result, existingChallenge);
});

test("uses Qatar-local day boundaries and rejects invalid input", () => {
  const result = selectDailyChallenge({
    now: "2026-11-10T21:30:00.000Z", // Nov 11 in Qatar
    topics: [{ id: "topic", is_available: true, available_question_count: 3 }],
  });

  assert.equal(result.date, "2026-11-11");
  assert.throws(() => selectDailyChallenge({ now: "invalid" }), /valid date/);
  assert.throws(() => selectDailyChallenge({ now, timeZone: "Not/AZone" }));
  assert.throws(() => selectDailyChallenge({ now, minimumPracticeQuestions: 4 }), /at least 5/);
});


test("requires at least five practice questions to match generated quiz persistence", () => {
  const undersized = selectDailyChallenge({
    now,
    topics: [{ id: "topic-small", is_available: true, available_question_count: 4 }],
    studyPacks: [{ id: "pack-small", status: "ready", available_question_count: 4 }],
  });
  const valid = selectDailyChallenge({
    now,
    topics: [{ id: "topic-valid", is_available: true, available_question_count: 5 }],
  });

  assert.equal(undersized.type, "unavailable");
  assert.equal(valid.type, "practice_topic");
  assert.equal(valid.questionCount, 5);
  assert.throws(() => selectDailyChallenge({ now, minimumPracticeQuestions: 4 }), /at least 5/);
});
