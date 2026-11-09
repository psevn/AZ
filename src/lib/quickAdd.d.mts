export type QuickAddSubject = { id: string; name: string };
export type QuickAddResult = {
 title: string; subjectId: string | null; dueDate: string | null; estMinutes: number;
 /** Existing database encoding: 3 high, 2 medium, 1 low. */ priority: number;
 /** User-facing rank token normalized to !1, !2, or !3. */ priorityToken: string;
 priorityNotice: boolean;
};
export function parseQuickAdd(input: string, subjects?: QuickAddSubject[], now?: Date): QuickAddResult;
