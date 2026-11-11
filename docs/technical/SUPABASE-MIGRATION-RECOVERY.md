# Supabase migration source recovery

## Scope and provenance

- Repository: `psevn/AZ`.
- Recovery branch: `recovery/missing-migrations-20261111`, based on `main` at `5b5c4ab6e11fa16d5dfdd42f810af49692f80fac`.
- Supabase project: `jgsgxyvilodxrpkmqrfx`.
- Source: read-only SELECT from `supabase_migrations.schema_migrations`.
- The live migration ledger returned **30 migrations**. Every row contains exactly one stored SQL statement.
- SQL text was copied from the stored statement, normalized to LF, and given one final newline. No SQL was executed against Supabase.

## Canonical migration inventory

The following files mirror all 30 versions currently recorded in the live migration ledger, in ledger order:

- `20261104141452_core_schema.sql`
- `20261104141502_storage.sql`
- `20261104142612_storage_documents_policies.sql`
- `20261104143417_fk_covering_indexes_and_storage_path_check.sql`
- `20261104143425_profile_autocreate_and_handoff_comments.sql`
- `20261104144827_temporarily_block_client_quiz_table_access.sql`
- `20261104144855_secure_quiz_answer_keys_and_server_grading.sql`
- `20261104145027_move_privileged_grading_implementation_to_private_schema.sql`
- `20261104145529_restrict_client_writes_to_server_managed_tables.sql`
- `20261104145805_index_private_question_keys_owner_fk.sql`
- `20261104150300_limit_client_table_grants_to_crud.sql`
- `20261105073535_fix_submit_answer_ambiguous_created_at.sql`
- `20261105122212_add_spec_columns_tables_and_lock_storage.sql`
- `20261105122304_quiz_attempts_per_quiz.sql`
- `20261105123204_credit_reservation_rpcs.sql`
- `20261105153306_add_academic_planning_foundation.sql`
- `20261105161922_schedule_sweep_stuck_reservations.sql`
- `20261108121410_exam_mode_flashcards_question_metadata.sql`
- `20261108131220_az_projects_foundation_and_unified_planning.sql`
- `20261108131237_az_projects_policy_and_index_hardening.sql`
- `20261108131303_az_projects_planning_deadline_title.sql`
- `20261108131557_restrict_planning_items_to_authenticated.sql`
- `20261108131613_limit_planning_items_to_select.sql`
- `20261108131704_enable_realtime_for_project_planning.sql`
- `20261108133920_create_primary_project_document_on_lead_membership.sql`
- `20261108134005_add_atomic_create_project_rpc.sql`
- `20261108134104_record_project_task_activity.sql`
- `20261108134226_enable_realtime_for_project_documents_and_activity.sql`
- `20261108153310_fix_create_project_rls_and_project_grants.sql`
- `20261109141845_tasks_completed_at.sql`

## Reconciliation with previous main-branch filenames

Two migration files in `main` used versions that do not match the live ledger:
- `20261104145802_index_private_question_keys_owner_fk.sql` is replaced in this recovery branch by canonical live-ledger version `20261104145805_index_private_question_keys_owner_fk.sql`. The index definition is equivalent; canonical source text is copied from the live ledger.
- `20261105160000_add_academic_planning_foundation.sql` is replaced in this recovery branch by `20261105153306_add_academic_planning_foundation.sql`, whose SQL body matches the live-ledger migration.

The two old paths are removed only on this recovery branch. No changes are made to `main`.

## Clean replay validation

- GitHub Actions workflow: [Clean migration replay](https://github.com/psevn/AZ/actions/runs/42971572647).
- Result: **success** on PostgreSQL 16.
- All 30 migration files were replayed, in filename order, against an empty disposable database.
- Post-replay assertions passed for core AZ, Planning, AZ Projects, private question keys, the credit sweep function, `tasks.completed_at`, and the local cron schedule record.
- Workflow log contained 30 replay steps and zero SQL `ERROR` entries.

### Explicit test limits

- Local-only stubs provide the minimum Supabase Auth, Storage, Realtime publication, and cron interfaces required for this replay.
- The `CREATE EXTENSION pg_cron` statement is omitted only in the disposable test replay because the CI PostgreSQL image does not install pg_cron. The migration's `cron.unschedule` and `cron.schedule` calls execute against a local stub. Actual pg_cron extension installation/runtime behavior is not tested.
- This is a clean SQL replay test, not a full Supabase platform integration test and not a behavioral test of every RLS policy or RPC.
- The existing audit harness starts from a live-schema snapshot and is not used as clean-bootstrap evidence.

## Safety

- Source retrieval used read-only SQL only.
- No SQL was applied to Supabase; no live schema changes, storage changes, or deployments were performed.
- No changes were made to `main`.
- This recovery remains a draft PR and is not merged.
