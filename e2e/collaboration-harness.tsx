import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import ProjectWorkspace from "../src/components/ProjectWorkspace";
import "../src/styles.css";

const USER_ONE = {
  id: "00000000-0000-4000-8000-000000000011",
  name: "Lead One",
  token: "e2e-user-one",
};
const USER_TWO = {
  id: "00000000-0000-4000-8000-000000000012",
  name: "Member Two",
  token: "e2e-user-two",
};
const PROJECT_ID = "00000000-0000-4000-8000-000000000033";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000022";

const project = {
  id: PROJECT_ID,
  title: "AZ Shared Document E2E",
  description: "A real browser test of the shared project workspace.",
  subject_id: null,
  due_at: null,
  status: "active",
  created_at: "2026-11-09T08:00:00.000Z",
};
const document = {
  id: DOCUMENT_ID,
  title: "Shared project document",
  document_type: "report",
  is_primary: true,
  updated_at: "2026-11-09T08:00:00.000Z",
};
const members = [
  { user_id: USER_ONE.id, role: "lead" as const, joined_at: "2026-11-09T08:00:00.000Z" },
  { user_id: USER_TWO.id, role: "member" as const, joined_at: "2026-11-09T08:01:00.000Z" },
];

function createMockClient(user: typeof USER_ONE | typeof USER_TWO): SupabaseClient {
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: user.token,
            refresh_token: "e2e-refresh-token",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: user.id, email: user.name.toLowerCase().replace(" ", ".") + "@example.test" },
          },
        },
        error: null,
      }),
    },
    from(table: string) {
      const result = table === "projects"
        ? project
        : table === "project_documents"
          ? document
          : table === "profiles"
            ? { display_name: user.name }
            : null;
      const rows = table === "project_members"
        ? members
        : table === "project_tasks" || table === "project_activity"
          ? []
          : [];
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: result, error: null }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return query;
    },
    channel() {
      const channel = {
        on() { return channel; },
        subscribe() { return channel; },
      };
      return channel;
    },
    removeChannel: async () => ({ status: "ok" }),
  };
  return client as unknown as SupabaseClient;
}

function Harness() {
  const params = new URLSearchParams(window.location.search);
  const selectedUser = params.get("user") === "2" ? USER_TWO : USER_ONE;
  const lang = params.get("lang") === "ar" ? "ar" : "en";
  const client = useMemo(() => createMockClient(selectedUser), [selectedUser.id]);

  return (
    <StrictMode>
      <main className="app-shell">
        <ProjectWorkspace
          client={client}
          lang={lang}
          projectId={PROJECT_ID}
          userId={selectedUser.id}
          onBack={() => undefined}
        />
      </main>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
