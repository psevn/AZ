import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const varsPath = resolve(root, "collaboration-worker/.dev.vars");
writeFileSync(varsPath, [
  "SUPABASE_URL=http://127.0.0.1:54321",
  "SUPABASE_ANON_KEY=e2e-anon-key",
  "COLLAB_TICKET_SECRET=az-e2e-collaboration-secret-which-is-long-enough-64",
  "",
].join("\n"));

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", "dev", "--", "--local", "--ip", "127.0.0.1", "--port", "8787"], {
  cwd: resolve(root, "collaboration-worker"),
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  try { rmSync(varsPath, { force: true }); } catch { /* best-effort cleanup */ }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  try { rmSync(varsPath, { force: true }); } catch { /* best-effort cleanup */ }
  process.exit(code ?? 0);
});
