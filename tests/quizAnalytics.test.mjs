import test from "node:test";
import assert from "node:assert/strict";
import { findWeakTopics, subjectAccuracy, computeStreak } from "../src/lib/quizAnalytics.mjs";

const T = (day, h = 10) => `2026-11-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;
const ans = (topic, ok, day, subjectId = "s1") => ({ topic, isCorrect: ok, answeredAt: T(day), subjectId });

test("weak topic needs at least 3 answers", () => {
  assert.deepEqual(findWeakTopics([ans("Elasticity", false, 1), ans("Elasticity", false, 2)]), []);
});

test("weak topic below 60% accuracy is reported with its numbers", () => {
  const rows = [ans("Elasticity", false, 1), ans("Elasticity", false, 2), ans("Elasticity", true, 3), ans("Supply", true, 1), ans("Supply", true, 2), ans("Supply", true, 3)];
  const weak = findWeakTopics(rows);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].topic, "Elasticity");
  assert.equal(weak[0].answered, 3);
  assert.equal(weak[0].correct, 1);
  assert.equal(weak[0].accuracy, 0.33);
});

test("only the latest 10 answers count and old mistakes age out", () => {
  const rows = [];
  for (let d = 1; d <= 5; d++) rows.push(ans("GDP", false, d));
  for (let d = 6; d <= 15; d++) rows.push(ans("GDP", true, d));
  assert.deepEqual(findWeakTopics(rows), []);
});

test("trend compares recent half to older half", () => {
  const rows = [ans("Cost", false, 1), ans("Cost", false, 2), ans("Cost", false, 3), ans("Cost", true, 4), ans("Cost", false, 5)];
  assert.equal(findWeakTopics(rows)[0].trend, "improving");
});

test("topics are scoped per subject and case-insensitive", () => {
  const rows = [ans("Ratios", false, 1, "a"), ans("ratios", false, 2, "a"), ans("Ratios", false, 3, "a"), ans("Ratios", true, 1, "b"), ans("Ratios", true, 2, "b"), ans("Ratios", true, 3, "b")];
  const weak = findWeakTopics(rows);
  assert.equal(weak.length, 1);
  assert.equal(weak[0].subjectId, "a");
});

test("invalid rows are ignored, not guessed", () => {
  const rows = [{ topic: "", isCorrect: false, answeredAt: T(1) }, { topic: "X", isCorrect: "no", answeredAt: T(1) }, { topic: "X", isCorrect: false, answeredAt: "bad" }, null];
  assert.deepEqual(findWeakTopics(rows), []);
  assert.deepEqual(subjectAccuracy(rows), []);
});

test("subject accuracy is plain correct/answered", () => {
  const out = subjectAccuracy([ans("a", true, 1, "s1"), ans("a", false, 2, "s1"), ans("b", true, 3, "s2")]);
  assert.deepEqual(out.map((s) => [s.subjectId, s.accuracy]), [["s1", 0.5], ["s2", 1]]);
});

const now = new Date("2026-11-12T08:00:00Z"); // 11:00 in Qatar

test("streak counts consecutive days in Qatar time and today may still be open", () => {
  const r = computeStreak([T(9), T(10), T(11)], { now });
  assert.equal(r.current, 3);
  assert.equal(r.activeToday, false);
});

test("a late-evening UTC activity belongs to the next Qatar day", () => {
  const r = computeStreak(["2026-11-11T21:30:00Z"], { now }); // 00:30 on the 12th in Qatar
  assert.equal(r.activeToday, true);
  assert.equal(r.current, 1);
});

test("one missed day is forgiven, two in a row break it", () => {
  assert.equal(computeStreak([T(8), T(10), T(11), T(12)], { now }).current, 4);
  assert.equal(computeStreak([T(7), T(10), T(11), T(12)], { now }).current, 3);
});

test("only one rest day per 7 days", () => {
  // active: 12, 11, 9 (missed 10), 7 (missed 8) -> second miss within 7 days breaks
  const r = computeStreak([T(12), T(11), T(9), T(7)], { now });
  assert.equal(r.current, 3);
});

test("no activity gives zero and never crashes", () => {
  assert.deepEqual(computeStreak([], { now }), { current: 0, longest: 0, restDayUsed: false, activeToday: false });
  assert.equal(computeStreak(["bad", null], { now }).current, 0);
});
