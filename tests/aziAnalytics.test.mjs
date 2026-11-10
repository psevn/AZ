import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAcademicActivity, buildAcademicInsights } from "../src/lib/aziAnalytics.mjs";

const now = new Date("2026-11-09T12:00:00.000Z"); // 15:00 in Qatar

test("empty and missing histories produce neutral zero metrics", () => {
  const result = analyzeAcademicActivity({ now });
  assert.equal(result.tasks.active, 0);
  assert.equal(result.tasks.overdue, 0);
  assert.equal(result.tasks.dueToday, 0);
  assert.equal(result.focus.minutesLastSevenDays, 0);
  assert.deepEqual(buildAcademicInsights(result), []);
});

test("deadline buckets use Qatar calendar dates", () => {
  const result = analyzeAcademicActivity({
    now,
    tasks: [
      { id: "late", status: "todo", due_at: "2026-11-08T20:59:00.000Z" },
      { id: "today", status: "doing", due_at: "2026-11-09T20:59:00.000Z" },
      { id: "tomorrow", status: "todo", due_at: "2026-11-09T21:00:00.000Z" },
      { id: "done", status: "done", due_at: "2026-11-01T10:00:00.000Z" },
      { id: "no-date", status: "todo", due_at: null },
    ],
  });

  assert.equal(result.tasks.overdue, 1);
  assert.equal(result.tasks.dueToday, 1);
  assert.equal(result.tasks.upcomingSevenDays, 1);
  assert.equal(result.tasks.active, 4);
  assert.deepEqual(result.tasks.overdueTaskIds, ["late"]);
});

test("completed tasks and focus sessions count only within the seven-day window", () => {
  const result = analyzeAcademicActivity({
    now,
    tasks: [
      { id: "recent", status: "done", completed_at: "2026-11-03T10:00:00.000Z" },
      { id: "old", status: "done", completed_at: "2026-11-01T10:00:00.000Z" },
    ],
    focusSessions: [
      { started_at: "2026-11-09T09:00:00.000Z", ended_at: "2026-11-09T10:30:00.000Z" },
      { started_at: "2026-11-03T09:00:00.000Z", ended_at: "2026-11-03T09:25:00.000Z" },
      { started_at: "2026-11-09T11:00:00.000Z", ended_at: "2026-11-09T10:00:00.000Z" },
    ],
  });

  assert.equal(result.tasks.completedLastSevenDays, 1);
  assert.equal(result.focus.sessionsLastSevenDays, 2);
  assert.equal(result.focus.minutesLastSevenDays, 115);
});

test("insights cite exact task IDs and propose navigation only", () => {
  const result = analyzeAcademicActivity({
    now,
    tasks: [
      { id: "late-1", status: "todo", due_at: "2026-11-08T10:00:00.000Z" },
      { id: "today-1", status: "doing", due_at: "2026-11-09T10:00:00.000Z" },
    ],
  });
  const insights = buildAcademicInsights(result);

  assert.equal(insights.length, 2);
  assert.deepEqual(insights[0].evidence.taskIds, ["late-1"]);
  assert.deepEqual(insights[0].action, {
    type: "navigate",
    destination: "planning",
    filter: "overdue",
  });
});

test("invalid timestamps are ignored and invalid now is rejected", () => {
  const result = analyzeAcademicActivity({
    now,
    tasks: [{ id: "bad", status: "todo", due_at: "not-a-date" }],
    focusSessions: [{ started_at: "bad", ended_at: "also-bad" }],
  });
  assert.equal(result.tasks.overdue, 0);
  assert.equal(result.tasks.dueToday, 0);
  assert.equal(result.focus.minutesLastSevenDays, 0);
  assert.throws(() => analyzeAcademicActivity({ now: "invalid" }), /valid date/);
});


test("weak topics require enough completed answers and exclude unfinished attempts", async () => {
  const { analyzeQuizPerformance } = await import("../src/lib/aziAnalytics.mjs");
  const result = analyzeQuizPerformance({
    now,
    attempts: [
      { id: "finished", finished_at: "2026-11-09T10:00:00.000Z" },
      { id: "unfinished", finished_at: null },
    ],
    questions: [
      { id: "q1", topic: "Algebra" },
      { id: "q2", topic: "Algebra" },
      { id: "q3", topic: "Algebra" },
      { id: "q4", topic: "Biology" },
    ],
    answers: [
      { attempt_id: "finished", question_id: "q1", is_correct: false },
      { attempt_id: "finished", question_id: "q2", is_correct: true },
      { attempt_id: "finished", question_id: "q3", is_correct: false },
      { attempt_id: "finished", question_id: "q4", is_correct: false },
      { attempt_id: "unfinished", question_id: "q4", is_correct: false },
    ],
  });

  assert.equal(result.topics.find((topic) => topic.topic === "Algebra").answered, 3);
  assert.equal(result.weakTopics.length, 1);
  assert.equal(result.weakTopics[0].topic, "Algebra");
  assert.equal(result.weakTopics[0].accuracy, 1 / 3);
});

test("study streak uses Qatar calendar days and tolerates a missed current day", async () => {
  const { analyzeQuizPerformance } = await import("../src/lib/aziAnalytics.mjs");
  const result = analyzeQuizPerformance({
    now: new Date("2026-11-09T12:00:00.000Z"),
    attempts: [
      { id: "a1", finished_at: "2026-11-06T20:30:00.000Z" }, // Nov 6 Qatar
      { id: "a2", finished_at: "2026-11-07T20:30:00.000Z" },
      { id: "a3", finished_at: "2026-11-08T20:30:00.000Z" },
    ],
  });

  assert.equal(result.streak.currentDays, 3);
  assert.equal(result.streak.longestDays, 3);
  assert.equal(result.streak.lastActiveDate, "2026-11-08");
});

test("study insights are based on weak-topic evidence and non-zero streaks", async () => {
  const { analyzeQuizPerformance, buildStudyInsights } = await import("../src/lib/aziAnalytics.mjs");
  const performance = analyzeQuizPerformance({
    now,
    attempts: [{ id: "finished", finished_at: "2026-11-09T10:00:00.000Z" }],
    questions: [{ id: "q1", topic: "Statistics" }, { id: "q2", topic: "Statistics" }, { id: "q3", topic: "Statistics" }],
    answers: [
      { attempt_id: "finished", question_id: "q1", is_correct: false },
      { attempt_id: "finished", question_id: "q2", is_correct: false },
      { attempt_id: "finished", question_id: "q3", is_correct: true },
    ],
  });
  const insights = buildStudyInsights(performance);

  assert.equal(insights[0].kind, "study_topic");
  assert.equal(insights[0].evidence.topic, "Statistics");
  assert.equal(insights[1].kind, "study_streak");
});

test("invalid analytics thresholds are rejected", async () => {
  const { analyzeQuizPerformance } = await import("../src/lib/aziAnalytics.mjs");
  assert.throws(() => analyzeQuizPerformance({ now, weakAccuracyThreshold: 2 }), /between 0 and 1/);
  assert.throws(() => analyzeQuizPerformance({ now, minimumTopicAnswers: 0 }), /positive integer/);
});
