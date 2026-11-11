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

function stableId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveCount(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function challengeKey(type, sourceId) {
  return `${type}:${sourceId}`;
}

/**
 * Selects one optional daily challenge from already-authorized, available source
 * records. This function does not fetch, persist, or mutate challenge state.
 */
export function selectDailyChallenge({
  reviewableMistakes = [],
  topics = [],
  studyPacks = [],
  now = new Date(),
  timeZone = "Asia/Qatar",
  recentChallengeKeys = [],
  dismissedChallengeKeys = [],
  existingChallenge = null,
  minimumPracticeQuestions = 5,
} = {}) {
  const instant = validDate(now);
  if (!instant) throw new TypeError("now must be a valid date");
  if (!Number.isInteger(minimumPracticeQuestions) || minimumPracticeQuestions < 5) {
    throw new TypeError("minimumPracticeQuestions must be at least 5");
  }

  const date = dateKeyInZone(instant, timeZone);
  if (!date) throw new TypeError("timeZone must be a valid time zone");

  if (existingChallenge?.date === date && existingChallenge?.status === "active") {
    return existingChallenge;
  }

  const excluded = new Set([
    ...recentChallengeKeys.filter((key) => typeof key === "string"),
    ...dismissedChallengeKeys.filter((key) => typeof key === "string"),
  ]);

  const candidates = [];

  for (const mistake of reviewableMistakes) {
    const sourceId = stableId(mistake?.id);
    if (!sourceId || mistake?.is_reviewable !== true) continue;
    const key = challengeKey("review_mistake", sourceId);
    if (excluded.has(key)) continue;
    candidates.push({
      priority: 0,
      challenge: {
        id: `${date}:${key}`,
        date,
        type: "review_mistake",
        sourceId,
        sourceTopicId: stableId(mistake.topic_id),
        titleKey: "dailyChallenge.reviewMistake.title",
        descriptionKey: "dailyChallenge.reviewMistake.description",
        action: { type: "review_mistake", mistakeId: sourceId },
        status: "active",
      },
    });
  }

  for (const topic of topics) {
    const sourceId = stableId(topic?.id);
    if (!sourceId || topic?.is_available !== true) continue;
    if (positiveCount(topic.available_question_count) < minimumPracticeQuestions) continue;
    const key = challengeKey("practice_topic", sourceId);
    if (excluded.has(key)) continue;
    candidates.push({
      priority: 1,
      challenge: {
        id: `${date}:${key}`,
        date,
        type: "practice_topic",
        sourceId,
        titleKey: "dailyChallenge.practiceTopic.title",
        descriptionKey: "dailyChallenge.practiceTopic.description",
        questionCount: minimumPracticeQuestions,
        action: {
          type: "start_topic_practice",
          topicId: sourceId,
          questionCount: minimumPracticeQuestions,
        },
        status: "active",
      },
    });
  }

  for (const pack of studyPacks) {
    const sourceId = stableId(pack?.id);
    if (!sourceId || pack?.status !== "ready") continue;
    if (positiveCount(pack.available_question_count) < minimumPracticeQuestions) continue;
    const key = challengeKey("practice_study_pack", sourceId);
    if (excluded.has(key)) continue;
    candidates.push({
      priority: 2,
      challenge: {
        id: `${date}:${key}`,
        date,
        type: "practice_study_pack",
        sourceId,
        titleKey: "dailyChallenge.practiceStudyPack.title",
        descriptionKey: "dailyChallenge.practiceStudyPack.description",
        questionCount: minimumPracticeQuestions,
        action: {
          type: "start_study_pack_practice",
          studyPackId: sourceId,
          questionCount: minimumPracticeQuestions,
        },
        status: "active",
      },
    });
  }

  candidates.sort((a, b) =>
    a.priority - b.priority ||
    a.challenge.sourceId.localeCompare(b.challenge.sourceId)
  );

  return candidates[0]?.challenge ?? {
    id: `${date}:unavailable`,
    date,
    type: "unavailable",
    titleKey: "dailyChallenge.unavailable.title",
    descriptionKey: "dailyChallenge.unavailable.description",
    action: null,
    status: "unavailable",
  };
}
