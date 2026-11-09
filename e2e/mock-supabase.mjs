import { createServer } from "node:http";

const USER_ONE = {
  id: "00000000-0000-4000-8000-000000000011",
  email: "lead@example.test",
};
const USER_TWO = {
  id: "00000000-0000-4000-8000-000000000012",
  email: "member@example.test",
};
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000022";
const PROJECT_ID = "00000000-0000-4000-8000-000000000033";

function json(res, value, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:54321");
  if (url.pathname === "/health") return json(res, { status: "ready" });

  if (url.pathname === "/auth/v1/user") {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (token === "e2e-user-one") return json(res, USER_ONE);
    if (token === "e2e-user-two") return json(res, USER_TWO);
    return json(res, { message: "Invalid token" }, 401);
  }

  if (url.pathname === "/rest/v1/project_documents") {
    if (url.searchParams.get("id") !== "eq." + DOCUMENT_ID) return json(res, []);
    return json(res, [{ id: DOCUMENT_ID, project_id: PROJECT_ID }]);
  }

  if (url.pathname === "/rest/v1/project_members") {
    if (url.searchParams.get("project_id") !== "eq." + PROJECT_ID) return json(res, []);
    const userId = (url.searchParams.get("user_id") || "").replace(/^eq\./, "");
    if (userId === USER_ONE.id) return json(res, [{ role: "lead" }]);
    if (userId === USER_TWO.id) return json(res, [{ role: "member" }]);
    return json(res, []);
  }

  return json(res, { message: "Not found", path: url.pathname }, 404);
});

server.listen(54321, "127.0.0.1", () => {
  process.stdout.write("E2E Supabase mock listening on http://127.0.0.1:54321\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
