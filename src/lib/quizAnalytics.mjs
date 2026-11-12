// Transparent, rule-based quiz analytics. No model calls, no cost, no inference about ability or motivation.
// Input rows come from attempt_answers joined with quiz_questions (topic) and quiz_attempts.
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEAK_TOPIC_RULES = Object.freeze({
  windowSize: 10,      // look at the last N answers per topic
  minAnswers: 3,       // never judge a topic on fewer answers
  weakBelowAccuracy: 0.6, // weak when accuracy over the window is below this
});

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateKeyInZone(value, timeZone = "Asia/Qatar") {
  const date = toDate(value);
  if (!date) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayNumber(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function validAnswer(row) {
  return row && typeof row.isCorrect === "boolean" && toDate(row.answeredAt) && typeof row.topic === "string" && row.topic.trim();
}

/**
 * Weak topics: per (subject, topic), accuracy over the last `windowSize` answers.
 * Returns topics judged on >= minAnswers answers and accuracy < weakBelowAccuracy,
 * worst first, each with the numbers that justify it so the UI can show the reason.
 */
export function findWeakTopics(answers = [], rules = {}) {
  const r = { ...WEAK_TOPIC_RULES, ...rules };
  const groups = new Map();
  for (const row of answers) {
    if (!validAnswer(row)) continue;
    const key = `${row.subjectId ?? ""}\u0000${row.topic.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { subjectId: row.subjectId ?? null, topic: row.topic.trim(), rows: [] });
    groups.get(key).rows.push(row);
  }
  const result = [];
  for (const g of groups.values()) {
    const rows = g.rows.sort((a, b) => toDate(b.answeredAt) - toDate(a.answeredAt)).slice(0, r.windowSize);
    if (rows.length < r.minAnswers) continue;
    const correct = rows.filter((x) => x.isCorrect).length;
    const accuracy = correct / rows.length;
    if (accuracy >= r.weakBelowAccuracy) continue;
    const recent = rows.slice(0, Math.ceil(rows.length / 2));
    const older = rows.slice(Math.ceil(rows.length / 2));
    const acc = (list) => (list.length ? list.filter((x) => x.isCorrect).length / list.length : null);
    const recentAcc = acc(recent);
    const olderAcc = acc(older);
    const trend = olderAcc === null ? "unknown" : recentAcc > olderAcc ? "improving" : recentAcc < olderAcc ? "declining" : "flat";
    result.push({
      subjectId: g.subjectId,
      topic: g.topic,
      answered: rows.length,
      correct,
      accuracy: Math.round(accuracy * 100) / 100,
      trend,
      lastAnsweredAt: toDate(rows[0].answeredAt).toISOString(),
    });
  }
  return result.sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.topic.localeCompare(b.topic));
}

/** Accuracy per subject over all valid answers (explainable, no weighting). */
export function subjectAccuracy(answers = []) {
  const map = new Map();
  for (const row of answers) {
    if (!validAnswer(row)) continue;
    const key = row.subjectId ?? "";
    const cur = map.get(key) ?? { subjectId: row.subjectId ?? null, answered: 0, correct: 0 };
    cur.answered += 1;
    if (row.isCorrect) cur.correct += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.answered) * 100) / 100 }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Study streak with a built-in rest day: one missed day is forgiven if no other
 * missed day was forgiven in the previous 6 days. Today not yet active does not break the streak.
 * `activityDates` are any timestamps that count as study (answers, finished focus sessions, completed tasks).
 */
export function computeStreak(activityDates = [], { now = new Date(), timeZone = "Asia/Qatar" } = {}) {
  const todayKey = dateKeyInZone(now, timeZone);
  if (!todayKey) return { current: 0, longest: 0, restDayUsed: false, activeToday: false };
  const active = new Set();
  for (const value of activityDates) {
    const key = dateKeyInZone(value, timeZone);
    if (key && key <= todayKey) active.add(dayNumber(key));
  }
  const today = dayNumber(todayKey);
  const activeToday = active.has(today);

  function run(startDay) {
    let streak = 0;
    let lastForgiven = -Infinity;
    let restDayUsed = false;
    for (let d = startDay; ; d--) {
      if (active.has(d)) { streak += 1; continue; }
      if (d === today) continue; // today still open
      if (d - 1 >= 0 && !active.has(d - 1) ) break; // two misses in a row end it
      if (lastForgiven - d < 7 && lastForgiven !== -Infinity) break; // only one rest day per 7 days
      // missed day d is forgiven only if the day before it was active
      lastForgiven = d;
      restDayUsed = true;
      if (!hasEarlierActivity(d)) break;
    }
    return { streak, restDayUsed };
  }
  const earliest = active.size ? Math.min(...active) : today;
  function hasEarlierActivity(d) { return d > earliest; }

  const { streak: current, restDayUsed } = run(today);

  // longest: scan every active day as a possible end of a run (bounded by number of active days)
  let longest = 0;
  for (const d of [...active].sort((a, b) => a - b)) {
    // a run ending on day d (not "today" semantics): compute using same rules
    let streak = 0; let lastForgiven = -Infinity;
    for (let x = d; x >= earliest; x--) {
      if (active.has(x)) { streak += 1; continue; }
      if (!active.has(x - 1)) break;
      if (lastForgiven !== -Infinity && lastForgiven - x < 7) break;
      lastForgiven = x;
    }
    if (streak > longest) longest = streak;
  }
  return { current, longest: Math.max(longest, current), restDayUsed, activeToday };
}
