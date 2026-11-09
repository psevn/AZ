# Supabase migration source recovery

Checked against the connected AZ Supabase project's migration history on 2026-11-09.

## AZ Projects migrations recovered in Git

The following four migration files were absent from the repository even though their versions were present in the live migration history:

- `20261108131220_az_projects_foundation_and_unified_planning.sql`
- `20261108131237_az_projects_policy_and_index_hardening.sql`
- `20261108131303_az_projects_planning_deadline_title.sql`
- `20261108153310_fix_create_project_rls_and_project_grants.sql`

The original SQL text was not available from the Git repository or the migration-history listing. These files are therefore **schema-equivalent reconstructions** based on read-only introspection of the live database: table columns, constraints, foreign keys, indexes, RLS policies, grants, helper functions, and the `planning_items` view. They are not represented as byte-for-byte recovery of the original authored migrations.

Two existing files had migration timestamps that did not match Supabase's migration history. Their filenames have been corrected to match the recorded versions:

- `20261104145805_index_private_question_keys_owner_fk.sql`
- `20261105153306_add_academic_planning_foundation.sql`

## Verification

- The four reconstructed migrations, the atomic project-creation correction, and the invitation/audit-hardening migration were run inside a transaction against the connected database and rolled back. The two trigger-creation migrations were excluded from this live dry-run because their triggers already exist; they are exercised in the disposable PostgreSQL CI test.
- Post-rollback checks confirmed that the invitation RPC was not left behind, the original activity insert policy remained, the task activity trigger function remained invoker-security, and the original activity event constraint was unchanged.
- The first disposable PostgreSQL 17 CI run exposed a real mismatch: the earlier atomic-create migration used `INSERT ... RETURNING`, while the live `create_project` function pre-generates its UUID and avoids `RETURNING` under member-only SELECT RLS. The later recovery migration now restores the live, RLS-compatible function definition.
- A disposable PostgreSQL 17 CI test exercises the recovered migrations, project creation, primary-document creation, task activity, email-bound invitation acceptance, and non-member RLS isolation. Its first run found the RLS-sensitive `RETURNING` mismatch, now corrected in the later migration. The next run exposed only a missing `service_role` grant in the test fixture; the fixture has been aligned with Supabase's service-role table access and is being rerun.

**No live migration was applied.** The transaction above was explicitly rolled back.

## Remaining migration-history gaps

The live database reports 29 migration versions. The repository currently contains source files for 18 of those versions plus the new pending invitation migration. The following 11 historical versions still have no matching source file in Git:

| Version | Supabase migration name |
|---|---|
| `20261104141452` | `core_schema` |
| `20261104141502` | `storage` |
| `20261104142612` | `storage_documents_policies` |
| `20261104143417` | `fk_covering_indexes_and_storage_path_check` |
| `20261104143425` | `profile_autocreate_and_handoff_comments` |
| `20261105073535` | `fix_submit_answer_ambiguous_created_at` |
| `20261105122212` | `add_spec_columns_tables_and_lock_storage` |
| `20261105122304` | `quiz_attempts_per_quiz` |
| `20261105123204` | `credit_reservation_rpcs` |
| `20261105161922` | `schedule_sweep_stuck_reservations` |
| `20261108121410` | `exam_mode_flashcards_question_metadata` |

These older migrations are not reconstructed yet. A clean database rebuild must remain blocked until their original SQL can be recovered or a separately reviewed, complete baseline schema is produced. Do not create guessed replacements for core schema, storage policies, grading, or credit-reservation logic.

## Pending migration

`20261108150000_secure_project_invitation_acceptance.sql` is a new migration in the feature branch and is intentionally not present in the live migration history. It must remain pending until separately reviewed and explicitly approved for application.
