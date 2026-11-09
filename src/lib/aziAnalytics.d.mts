export type AcademicTask = {
  id?: string;
  subject_id?: string | null;
  due_at?: string | null;
  status?: string | null;
  completed_at?: string | null;
};

export type FocusSession = {
  started_at?: string | null;
  ended_at?: string | null;
};

export type AcademicActivityMetrics = {
  asOf: string;
  timeZone: string;
  window: { startDate: string; endDate: string };
  tasks: {
    total: number;
    active: number;
    overdue: number;
    dueToday: number;
    upcomingSevenDays: number;
    completedLastSevenDays: number;
    overdueTaskIds: string[];
    dueTodayTaskIds: string[];
    subjectActiveCounts: Record<string, number>;
  };
  focus: {
    sessionsLastSevenDays: number;
    minutesLastSevenDays: number;
  };
};

export function analyzeAcademicActivity(input?: {
  tasks?: AcademicTask[];
  focusSessions?: FocusSession[];
  now?: Date | string;
  timeZone?: string;
}): AcademicActivityMetrics;

export type AcademicInsight = {
  id: string;
  kind: "task_deadline";
  severity: "warning" | "info";
  title: string;
  message: string;
  evidence: { count: number; taskIds: string[]; asOf: string };
  action: { type: "navigate"; destination: "planning"; filter: "overdue" | "today" };
};

export function buildAcademicInsights(metrics: AcademicActivityMetrics): AcademicInsight[];
