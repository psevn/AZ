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
  for (const session of focusSessions) {
    const startedAt = validDate(session?.started_at);
    const endedAt = validDate(session?.ended_at);
    if (!startedAt || !endedAt || endedAt <= startedAt) continue;
    if (!isWithinLastSevenDays(endedAt, startKey, today, timeZone)) continue;
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
      sessionsLastSevenDays: focusSessions.filter((session) =>
        session?.ended_at && isWithinLastSevenDays(session.ended_at, startKey, today, timeZone),
      ).length,
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
