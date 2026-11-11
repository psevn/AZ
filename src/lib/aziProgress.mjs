const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKeyInZone(value, timeZone) {
  const date = validDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function addDays(key, amount) {
  return new Date((dayNumber(key) + amount) * DAY_MS).toISOString().slice(0, 10);
}

function uniqueId(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Derives transparent learning activity from completed, already user-scoped rows.
 * It never infers ability, motivation, personality, or reasons for inactivity.
 */
export function analyzeLearningProgress({
  quizAttempts = [],
  focusSessions = [],
  mistakeReviews = [],
  now = new Date(),
  timeZone = "Asia/Qatar",
  minTopicAnswers = 3,
} = {}) {
  const instant = validDate(now);
  if (!instant) throw new TypeError("now must be a valid date");
  if (!Number.isInteger(minTopicAnswers) || minTopicAnswers < 1) {
    throw new TypeError("minTopicAnswers must be a positive integer");
  }

  const todayKey = dateKeyInZone(instant, timeZone);
  const windowStart = addDays(todayKey, -6);
  const activityDays = new Set();
  const seenSourceIds = new Set();
  const completedAttempts = [];
  const completedSessions = [];
  const validReviews = [];

  for (const attempt of quizAttempts) {
    const id = uniqueId(attempt?.id);
    const completedAt = validDate(attempt?.completed_at);
    if (!id || attempt?.status !== "completed" || !completedAt || completedAt > instant) continue;
    const sourceKey = `quiz:${id}`;
    if (seenSourceIds.has(sourceKey)) continue;
    seenSourceIds.add(sourceKey);
    completedAttempts.push({ ...attempt, id, completedAt });
    const dayKey = dateKeyInZone(completedAt, timeZone);
    if (dayKey) activityDays.add(dayKey);
  }

  for (const session of focusSessions) {
    const id = uniqueId(session?.id);
    const startedAt = validDate(session?.started_at);
    const endedAt = validDate(session?.ended_at);
    if (!id || !startedAt || !endedAt || endedAt <= startedAt || endedAt > instant) continue;
    const sourceKey = `focus:${id}`;
    if (seenSourceIds.has(sourceKey)) continue;
    seenSourceIds.add(sourceKey);
    completedSessions.push({ id, startedAt, endedAt });
    const dayKey = dateKeyInZone(endedAt, timeZone);
    if (dayKey) activityDays.add(dayKey);
  }

  for (const review of mistakeReviews) {
    const id = uniqueId(review?.id);
    const reviewedAt = validDate(review?.reviewed_at);
    if (!id || !reviewedAt || reviewedAt > instant) continue;
    const sourceKey = `review:${id}`;
    if (seenSourceIds.has(sourceKey)) continue;
    seenSourceIds.add(sourceKey);
    validReviews.push({ id, reviewedAt });
    const dayKey = dateKeyInZone(reviewedAt, timeZone);
    if (dayKey) activityDays.add(dayKey);
  }

  const topicRows = new Map();
  const seenAnswerIds = new Set();
  for (const attempt of completedAttempts) {
    for (const answer of Array.isArray(attempt.answers) ? attempt.answers : []) {
      const answerId = uniqueId(answer?.id);
      const topicId = uniqueId(answer?.topic_id);
      const submittedAt = validDate(answer?.submitted_at);
      if (!answerId || !topicId || typeof answer.is_correct !== "boolean" || !submittedAt) continue;
      if (submittedAt > instant || submittedAt > attempt.completedAt) continue;
      const submittedDay = dateKeyInZone(submittedAt, timeZone);
      if (!submittedDay || submittedDay < windowStart || submittedDay > todayKey) continue;
      if (seenAnswerIds.has(answerId)) continue;
      seenAnswerIds.add(answerId);
      const row = topicRows.get(topicId) ?? { topicId, totalAnswers: 0, correctAnswers: 0 };
      row.totalAnswers += 1;
      if (answer.is_correct) row.correctAnswers += 1;
      topicRows.set(topicId, row);
    }
  }

  const topics = [...topicRows.values()]
    .sort((a, b) => a.topicId.localeCompare(b.topicId))
    .map((row) => {
      const accuracyPercent = Math.round((row.correctAnswers / row.totalAnswers) * 1000) / 10;
      return {
        topicId: row.topicId,
        sampleSize: row.totalAnswers,
        correctAnswers: row.correctAnswers,
        accuracyPercent: row.totalAnswers >= minTopicAnswers ? accuracyPercent : null,
        status: row.totalAnswers < minTopicAnswers
          ? "insufficient_data"
          : accuracyPercent < 60
            ? "review_recommended"
            : "on_track",
      };
    });

  const sortedDays = [...activityDays].sort();
  const studyDaysLastSevenDays = sortedDays.filter((key) => key >= windowStart && key <= todayKey).length;
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDay = null;
  for (const key of sortedDays) {
    runningStreak = previousDay !== null && dayNumber(key) === dayNumber(previousDay) + 1
      ? runningStreak + 1
      : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDay = key;
  }

  const yesterdayKey = addDays(todayKey, -1);
  let currentStreak = 0;
  let cursor = activityDays.has(todayKey)
    ? todayKey
    : activityDays.has(yesterdayKey)
      ? yesterdayKey
      : null;
  while (cursor && activityDays.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    asOf: instant.toISOString(),
    timeZone,
    window: { startDate: windowStart, endDate: todayKey },
    activity: {
      studyDaysLastSevenDays,
      currentStreak,
      longestStreak,
      completedQuizAttempts: completedAttempts.length,
      completedFocusSessions: completedSessions.length,
      reviewedMistakes: validReviews.length,
    },
    topics,
  };
}
