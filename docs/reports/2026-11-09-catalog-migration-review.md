# Review — 20261109130000_qatar_first_academic_catalog.sql (PR #9, Claude, 2026-11-09)

Method: static read of the file at branch `fix/course-catalog-term-aware` + read-only queries on the live DB. **Not executed** on a local replica; the PR's own CI (`validate-course-catalog-fix.yml`, `tests/sql/*`) was not reviewed.

## Live state (verified today)
No catalog tables exist on the live DB; last applied migration is 20261108153310. `subjects` has 0 rows for the owner, so Planning shows none. The catalog is a read-only list; a course reaches Planning only when a `subjects` row is created from it.

## Good
RLS on, select-only grant to `authenticated`, anon revoked; `search_academic_catalog` is SECURITY INVOKER with fixed search_path, limit clamp 1..50; unique indexes on (user, term, catalog_course) incl. no-term case; every course carries source_url/source_name/source_checked_at; seed inserts are guarded by WHERE NOT EXISTS.

## Findings
1. (Medium) Coverage gap: no ACCT/FINC/MIS/ECON/MGMT/MKTG/STAT courses — the owner's college (Management & Economics) is not covered. Sources are QU Core, HBKU, UDST, NU-Q, MoE only.
2. (Medium) `verification_status` defaults to 'verified' and all rows are 'verified', including generic school subjects sourced to a Ministry "mandate" page that is not a course list. Mark those 'draft' or cite a real curriculum page.
3. (Medium) SELECT policy is `using (true)`: draft/archived rows and inactive institutions are readable by direct table select. Use `verification_status='verified'` (and active institution) in the policy.
4. (Low) No unique key on courses (institution, curriculum, code/name). Duplicates are prevented only by WHERE NOT EXISTS in seeds; add a unique index.
5. (Low) Search sorts school courses first for every query; a university student sees school subjects before university courses. Order by requested level.
6. (Low) User text is placed in ILIKE without escaping % and _ ; leading-wildcard ILIKE ignores the lower() btree indexes (fine at current size; add pg_trgm if the catalog grows large).
7. (Check) `subjects.term_id` is assumed to exist for the unique indexes: confirm against live (`20261105153306`).
8. Not reviewed: the client code that creates `subjects` from a catalog course (Courses.tsx) — must insert with the caller's user_id only and handle the duplicate-key error gracefully.

Verdict: safe to apply after fixes 2–3 and 7 are checked and a local replay passes; 1 is a product gap, not a safety issue. Applying to the live DB remains the owner's decision.

## Update — local run of the fixed migration (branch `fix/catalog-migration-review-followups` @343e720)
Replayed on the throwaway local PostgreSQL 16 (snapshot + all repo migrations + the catalog file): applies cleanly; existing suites still pass (credits 61/61). New file `supabase/tests/catalog_tests.sql`: **17/17 passed** — anon blocked; authenticated read-only; draft rows invisible; ACCT/Accounting/محاسبة searches return results; limit clamps to 50; higher-level search is not school-first; user can add a catalog subject for self, duplicate blocked, cannot insert for another user, other users cannot see it.
Verified fixes: SELECT policies now require verified + active institution; the 5 generic school courses are 'draft'; business-code courses present (17 with ACCT/FINC/MIS/ECON/MGMT/MKTG/STAT/ISOM/BUSS/BLAW prefixes, QU).
Limits of this check: local replica only (not live); the `%` test is weak (passes if '%' returns fewer rows than the empty query); the term-scoped duplicate index and the client code (`Courses.tsx`) were not exercised; course data accuracy (codes, names, credit hours) was not verified against the sources.
