const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKeyInZone(value, timeZone) {
  const date = value instanceof Date ? value : validDate(value);
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

function dayNumber(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function isWithinLastSevenDays(value, startKey, todayKey, timeZone) {
  const key = dateKeyInZone(value, timeZone);
  return key !== null && key >= startKey && key <= todayKey;
}

/**
 * Computes transparent activity metrics only. It does not infer ability,
 * motivation, personality, or reasons for missed work.
 */
export function analyzeAcademicActivity({
  tasks = [],
  focusSessions = [],
  now = new Date(),
  timeZone = "Asia/Qatar",
} = {}) {
  const instant = validDate(now);
  if (!instant) throw new TypeError("now must be a valid date");

  const today = dateKeyInZone(instant, timeZone);
  const sevenDaysAgo = new Date(dayNumber(today) * DAY_MS - 6 * DAY_MS);
  const startKey = dateKeyInZone(sevenDaysAgo, "UTC");
  const todayNumber = dayNumber(today);
  const activeTasks = tasks.filter((task) => task && task.status !== "done");
  const overdueTasks = activeTasks.filter((task) => {
    const dueKey = dateKeyInZone(task.due_at, timeZone);
    return dueKey !== null && dueKey < today;
  });
  const dueTodayTasks = activeTasks.filter(
    (task) => dateKeyInZone(task.due_at, timeZone) === today,
  );
  const upcomingTasks = activeTasks.filter((task) => {
    const dueKey = dateKeyInZone(task.due_at, timeZone);
    return dueKey !== null && dueKey > today && dayNumber(dueKey) <= todayNumber + 7;
  });
  const completedLastSevenDays = tasks.filter((task) =>
    task?.status === "done" &&
    task.completed_at &&
    isWithinLastSevenDays(task.completed_at, startKey, today, timeZone),
  );

  let focusMilliseconds = 0;
  let sessionsLastSevenDays = 0;
  for (const session of focusSessions) {
    const startedAt = validDate(session?.started_at);
    const endedAt = validDate(session?.ended_at);
    if (!startedAt || !endedAt || endedAt <= startedAt) continue;
    if (!isWithinLastSevenDays(endedAt, startKey, today, timeZone)) continue;
    sessionsLastSevenDays += 1;
    focusMilliseconds += endedAt.getTime() - startedAt.getTime();
  }

  const subjectTaskCounts = {};
  for (const task of activeTasks) {
    if (!task.subject_id) continue;
    subjectTaskCounts[task.subject_id] = (subjectTaskCounts[task.subject_id] ?? 0) + 1;
  }

  return {
    asOf: instant.toISOString(),
    timeZone,
    window: { startDate: startKey, endDate: today },
    tasks: {
      total: tasks.length,
      active: activeTasks.length,
      overdue: overdueTasks.length,
      dueToday: dueTodayTasks.length,
      upcomingSevenDays: upcomingTasks.length,
      completedLastSevenDays: completedLastSevenDays.length,
      overdueTaskIds: overdueTasks.map((task) => task.id).filter(Boolean),
      dueTodayTaskIds: dueTodayTasks.map((task) => task.id).filter(Boolean),
      subjectActiveCounts: subjectTaskCounts,
    },
    focus: {
      sessionsLastSevenDays,
      minutesLastSevenDays: Math.round(focusMilliseconds / 60000),
    },
  };
}

/** Creates a small set of evidence-backed notices; never diagnoses the student. */
export function buildAcademicInsights(metrics) {
  if (!metrics || !metrics.tasks || !metrics.focus) {
    throw new TypeError("metrics must come from analyzeAcademicActivity");
  }

  const insights = [];
  if (metrics.tasks.overdue > 0) {
    insights.push({
      id: "overdue-tasks",
      kind: "task_deadline",
      severity: "warning",
      title: "Overdue tasks",
      message: `You have ${metrics.tasks.overdue} overdue task(s).`,
      evidence: {
        count: metrics.tasks.overdue,
        taskIds: metrics.tasks.overdueTaskIds,
        asOf: metrics.asOf,
      },
      action: { type: "navigate", destination: "planning", filter: "overdue" },
    });
  }

  if (metrics.tasks.dueToday > 0) {
    insights.push({
      id: "tasks-due-today",
      kind: "task_deadline",
      severity: "info",
      title: "Tasks due today",
      message: `You have ${metrics.tasks.dueToday} unfinished task(s) due today.`,
      evidence: {
        count: metrics.tasks.dueToday,
        taskIds: metrics.tasks.dueTodayTaskIds,
        asOf: metrics.asOf,
      },
      action: { type: "navigate", destination: "planning", filter: "today" },
    });
  }

  return insights;
}


/**
 * Summarizes completed quiz answers by topic and calculates a calendar-day
 * practice streak. Only finished attempts count; unanswered/in-progress
 * attempts never affect accuracy or streaks.
 *
 * Input rows are plain records from quiz_attempts, attempt_answers and
 * quiz_questions. Callers must scope all three queries to the signed-in user.
 */
export function analyzeQuizPerformance({
  attempts = [],
  answers = [],
  questions = [],
  now = new Date(),
  timeZone = "Asia/Qatar",
  weakAccuracyThreshold = 0.6,
  minimumTopicAnswers = 3,
} = {}) {
  const instant = validDate(now);
  if (!instant) throw new TypeError("now must be a valid date");
  if (!(weakAccuracyThreshold >= 0 && weakAccuracyThreshold <= 1)) {
    throw new RangeError("weakAccuracyThreshold must be between 0 and 1");
  }
  if (!Number.isInteger(minimumTopicAnswers) || minimumTopicAnswers < 1) {
    throw new RangeError("minimumTopicAnswers must be a positive integer");
  }

  const finishedAttempts = attempts.filter((attempt) => attempt?.id && validDate(attempt.finished_at));
  const finishedById = new Map(finishedAttempts.map((attempt) => [attempt.id, attempt]));
  const questionById = new Map(questions.filter((question) => question?.id).map((question) => [question.id, question]));
  const topicCounts = new Map();

  for (const answer of answers) {
    if (!answer || typeof answer.is_correct !== "boolean" || !finishedById.has(answer.attempt_id)) continue;
    const question = questionById.get(answer.question_id);
    const topic = typeof question?.topic === "string" ? question.topic.trim() : "";
    if (!topic) continue;
    const counts = topicCounts.get(topic) ?? { topic, answered: 0, correct: 0 };
    counts.answered += 1;
    if (answer.is_correct) counts.correct += 1;
    topicCounts.set(topic, counts);
  }

  const topics = [...topicCounts.values()]
    .map((topic) => ({
      ...topic,
      incorrect: topic.answered - topic.correct,
      accuracy: topic.answered ? topic.correct / topic.answered : 0,
      isWeak: topic.answered >= minimumTopicAnswers && topic.correct / topic.answered < weakAccuracyThreshold,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.topic.localeCompare(b.topic));

  const activeDates = [...new Set(finishedAttempts
    .map((attempt) => dateKeyInZone(attempt.finished_at, timeZone))
    .filter(Boolean))].sort();
  const activeSet = new Set(activeDates);
  const today = dateKeyInZone(instant, timeZone);
  const todayNumber = dayNumber(today);
  const lastActiveDate = activeDates.at(-1) ?? null;
  const lastActiveNumber = lastActiveDate ? dayNumber(lastActiveDate) : null;

  let currentDays = 0;
  if (lastActiveNumber !== null && todayNumber - lastActiveNumber <= 1) {
    let cursor = lastActiveNumber;
    while (activeSet.has(new Date(cursor * DAY_MS).toISOString().slice(0, 10))) {
      currentDays += 1;
      cursor -= 1;
    }
  }

  let longestDays = 0;
  let runDays = 0;
  let previousNumber = null;
  for (const dateKey of activeDates) {
    const number = dayNumber(dateKey);
    runDays = previousNumber !== null && number === previousNumber + 1 ? runDays + 1 : 1;
    longestDays = Math.max(longestDays, runDays);
    previousNumber = number;
  }

  return {
    asOf: instant.toISOString(),
    timeZone,
    topics,
    weakTopics: topics.filter((topic) => topic.isWeak),
    streak: {
      currentDays,
      longestDays,
      activeDays: activeDates.length,
      lastActiveDate,
    },
  };
}

/** Converts calculated study performance into neutral, evidence-backed notices. */
export function buildStudyInsights(performance) {
  if (!performance || !Array.isArray(performance.weakTopics) || !performance.streak) {
    throw new TypeError("performance must come from analyzeQuizPerformance");
  }

  const insights = performance.weakTopics.map((topic) => ({
    id: `weak-topic-${topic.topic}`,
    kind: "study_topic",
    severity: "info",
    title: "Topic to revisit",
    message: `Recent quiz accuracy for ${topic.topic} is ${Math.round(topic.accuracy * 100)}%.`,
    evidence: {
      topic: topic.topic,
      answered: topic.answered,
      correct: topic.correct,
      incorrect: topic.incorrect,
      accuracy: topic.accuracy,
      asOf: performance.asOf,
    },
    action: { type: "navigate", destination: "quiz", topic: topic.topic },
  }));

  if (performance.streak.currentDays > 0) {
    insights.push({
      id: "study-streak",
      kind: "study_streak",
      severity: "info",
      title: "Study streak",
      message: `${performance.streak.currentDays} consecutive day(s) with a completed quiz.`,
      evidence: { ...performance.streak, asOf: performance.asOf },
      action: { type: "navigate", destination: "quiz" },
    });
  }

  return insights;
}
