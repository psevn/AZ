---
name: az-db-migration
description: Use when writing, reviewing or applying a Supabase/Postgres migration for AZ, or when the repo and the live database may disagree. Enforces live-first inspection, isolation patterns, verification, and approval before any live change.
---

# AZ database migration workflow

Projects: `AZ` (production, `jgsgxyvilodxrpkmqrfx`, ap-south-1) and `AZ-Staging` (`tskdpubkxkirtmrwujrs`). Confirm the project id before every call.

## 1. Inspect the live project first (read-only)
- `list_migrations`, `list_tables` (verbose) and read-only `execute_sql`. The repo alone is not the truth: it once held 7 of 30 applied migrations.
- Compare repo version numbers with the live ones. Filename = live version + name.
- Never edit or rename an already-applied migration to change behavior. Add a new migration. (A rename is allowed only to match the live version, with unchanged content.)

## 2. Isolation and security patterns (keep them)
- Every user-content table has `user_id uuid not null references auth.users(id) on delete cascade`, a `unique (id, user_id)`, and composite foreign keys `(parent_id, user_id)` so rows cannot link across users.
- Enable RLS on every new public table. Policies use `(select auth.uid())`. Add an index for every foreign key.
- Revoke from `anon`. Grant clients only what they need: select-only when writes go through RPCs.
- Server-managed data (grading keys, credits, usage) is written only by trusted functions. Answer keys live in `private`, never in a client-readable table.
- `security definer` functions: `set search_path = ''`, schema-qualified names, `revoke ... from public, anon`, explicit grants. Pattern used here: logic in `private.*`, thin `public.*` SQL wrapper.
- Project tables use membership helpers (`private.is_project_member`, `is_project_lead`, `is_project_creator`). Project features read only `project_*` data, never a member's private study data.
- Destructive changes start with a guard that aborts if data exists (see `do $guard$` blocks in existing migrations).
- No secrets, keys or personal data in migrations. Do not alter `auth` or `storage` internals except policies and buckets.

## 3. Verify before proposing
1. If a local PostgreSQL is available, replay all migrations in version order on an empty database with minimal stand-ins (`auth.users`, `auth.uid()`, `storage.buckets`/`storage.objects`, roles `anon`/`authenticated`/`service_role` with Supabase-style default privileges, `supabase_realtime`, a stub `cron`). Every file must apply.
2. Compare a fingerprint with the live project: columns, constraints, indexes, policies, functions (hash of the definition), triggers and table grants in `public` and `private`. Differences must be explained.
3. State what the test did not cover (real extensions, storage objects, data).
4. For new tables, add or update isolation tests: user A cannot read, write or link to user B's rows (SPEC §5.5).

## 4. Applying to a live project
- Needs explicit approval from PSEVN for the specific project and migration. Never apply as a side effect of another task.
- Prefer `AZ-Staging` first. After applying, run the advisors (security and performance) and read the findings.
- Afterwards the repo file must equal the applied statement under the live version number. Export it from `supabase_migrations.schema_migrations` instead of retyping, and check the hash.

## 5. Report
In the PR: what changes, why, which project(s) it was checked against, what was and was not verified, and the rollback plan (a new migration, never a rewrite of history).
