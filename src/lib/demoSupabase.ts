// DEMO MODE ONLY (build-time flag VITE_DEMO=1). Used by the visual-QA pipeline so every page can be
// rendered and screenshotted without a real account or network. Contains fixture data only — it never
// talks to Supabase. Production builds do not set VITE_DEMO, so this module is tree-shaken out.
import type { SupabaseClient } from "@supabase/supabase-js";

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour = 12) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const USER = "00000000-0000-4000-8000-000000000001";
const S1 = "00000000-0000-4000-8000-0000000000a1";
const S2 = "00000000-0000-4000-8000-0000000000a2";
const S3 = "00000000-0000-4000-8000-0000000000a3";
const now = new Date().toISOString();

const tables: Record<string, Record<string, unknown>[]> = {
  subjects: [
    { id: S1, user_id: USER, name: "Principles of Economics", color: "#20E6F2", exam_date: at(9).slice(0, 10), created_at: now },
    { id: S2, user_id: USER, name: "Financial Accounting", color: "#0879E8", exam_date: at(16).slice(0, 10), created_at: now },
    { id: S3, user_id: USER, name: "Business Statistics", color: "#8A00E8", exam_date: null, created_at: now },
  ],
  tasks: [
    { id: "t1", user_id: USER, subject_id: S1, title: "Review Chapter 3 — supply and demand", due_at: at(0, 18), priority: 1, est_minutes: 45, status: "doing", note: null, completed_at: null, document_id: null, created_at: now },
    { id: "t2", user_id: USER, subject_id: S2, title: "Problem set 4", due_at: at(1, 18), priority: 2, est_minutes: 60, status: "todo", note: null, completed_at: null, document_id: null, created_at: now },
    { id: "t3", user_id: USER, subject_id: S3, title: "Read 20 pages", due_at: at(3, 18), priority: 3, est_minutes: 30, status: "todo", note: null, completed_at: null, document_id: null, created_at: now },
    { id: "t4", user_id: USER, subject_id: S1, title: "Quiz prep", due_at: at(-1, 18), priority: 1, est_minutes: 40, status: "todo", note: null, completed_at: null, document_id: null, created_at: now },
    { id: "t5", user_id: USER, subject_id: null, title: "Email the advisor", due_at: null, priority: 2, est_minutes: 10, status: "todo", note: null, completed_at: null, document_id: null, created_at: now },
    { id: "t6", user_id: USER, subject_id: S2, title: "Summarise lecture 2", due_at: at(-2, 18), priority: 2, est_minutes: 30, status: "done", note: null, completed_at: now, document_id: null, created_at: now },
  ],
  documents: [
    { id: "d1", user_id: USER, title: "Economics — Chapter 3.pdf", subject_id: S1, status: "ready", created_at: now },
    { id: "d2", user_id: USER, title: "Accounting — Lecture 2.pdf", subject_id: S2, status: "ready", created_at: now },
  ],
  academic_terms: [{ id: "term1", user_id: USER, name: "Fall 2026", start_date: "2026-08-30", end_date: "2026-12-20", is_active: true }],
  academic_setup: [{ user_id: USER, status: "completed", current_step: 5 }],
  focus_sessions: [],
};

type Result = { data: unknown; error: null };

function builder(table: string) {
  let mode: "read" | "write" = "read";
  let single = false;
  const rows = () => tables[table] ?? [];
  const settle = (): Result => {
    if (mode === "write") return { data: single ? (rows()[0] ?? null) : [], error: null };
    return { data: single ? (rows()[0] ?? null) : rows(), error: null };
  };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "order", "eq", "neq", "in", "is", "lt", "lte", "gt", "gte", "like", "ilike", "not", "or", "filter", "match", "limit", "range", "contains", "returns"]) {
    chain[m] = self;
  }
  for (const m of ["insert", "update", "upsert", "delete"]) {
    chain[m] = () => { mode = "write"; return chain; };
  }
  chain.maybeSingle = () => { single = true; return chain; };
  chain.single = () => { single = true; return chain; };
  chain.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(settle()).then(resolve, reject);
  return chain;
}

export const demoClient = {
  auth: {
    getUser: async () => ({ data: { user: { id: USER, email: "student@example.com" } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({ data: {}, error: null }),
    signUp: async () => ({ data: {}, error: null }),
  },
  from: (table: string) => builder(table),
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "#" }, error: null }) }) },
} as unknown as SupabaseClient;
