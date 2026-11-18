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

test("new focus sessions prefer active seconds and exclude paused wall-clock time", () => {
  const result = analyzeAcademicActivity({
    now,
    focusSessions: [
      {
        started_at: "2026-11-09T09:00:00.000Z",
        ended_at: "2026-11-09T10:30:00.000Z",
        active_seconds: 900,
      },
      {
        started_at: "2026-11-09T10:30:00.000Z",
        ended_at: "2026-11-09T11:00:00.000Z",
        active_seconds: 0,
      },
    ],
  });

  assert.equal(result.focus.sessionsLastSevenDays, 2);
  assert.equal(result.focus.minutesLastSevenDays, 15);
});

test("legacy focus sessions fall back to wall-clock duration", () => {
  const result = analyzeAcademicActivity({
    now,
    focusSessions: [
      { started_at: "2026-11-09T09:00:00.000Z", ended_at: "2026-11-09T09:25:00.000Z" },
      {
        started_at: "2026-11-09T09:25:00.000Z",
        ended_at: "2026-11-09T10:00:00.000Z",
        active_seconds: null,
      },
      {
        started_at: "2026-11-09T10:00:00.000Z",
        ended_at: "2026-11-09T10:30:00.000Z",
        active_seconds: -1,
      },
    ],
  });

  assert.equal(result.focus.sessionsLastSevenDays, 2);
  assert.equal(result.focus.minutesLastSevenDays, 60);
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
