# Supabase migration source recovery

## Scope and provenance

- Repository: `psevn/AZ`.
- Recovery branch base: `main` at commit `5b5c4ab6e11fa16d5dfdd42f810af49692f80fac`.
- Supabase project: `jgsgxyvilodxrpkmqrfx`.
- Source: read-only SELECT from `supabase_migrations.schema_migrations`.
- Each recovered version returned exactly one SQL statement.
- SQL was copied from the stored source text, normalized to LF, and given exactly one final newline. No SQL was executed against Supabase.

## Recovered files and fingerprints

| Version | File | Source bytes | File bytes | Source MD5 | Normalized file MD5 |
|---|---|---:|---:|---|---|
| 20261104141452 | `20261104141452_core_schema.sql` | 6180 | 6181 | `de58754f93529ac61f5464606df7f758` | `1eace223d78e9868605e3520c6c0d9b8` |
| 20261104141502 | `20261104141502_storage.sql` | 303 | 304 | `d361089290a442767fb148b0e78f7738` | `343b44226ec61abbc8525508850a1557` |
| 20261104142612 | `20261104142612_storage_documents_policies.sql` | 832 | 833 | `a7678e24843e1ec86bfe21ecc53d82dd` | `3995e0c5c54479422e0a5ede65aaf37e` |
| 20261104143417 | `20261104143417_fk_covering_indexes_and_storage_path_check.sql` | 1127 | 1128 | `92623497b44c18fc737000b1dec1f39a` | `169cf766bea5040eff58155acbce7f0a` |
| 20261104143425 | `20261104143425_profile_autocreate_and_handoff_comments.sql` | 1264 | 1265 | `a08d3bb841f05901b6442723c5ca0a18` | `ff9dd5804920e0c8eaa642023c60ff07` |
| 20261105161922 | `20261105161922_schedule_sweep_stuck_reservations.sql` | 509 | 510 | `93c9b951437f0ac2332d78434e0c1de2` | `d5b182754e22a59b4ec71e9b6cfedb5a` |
| 20261109141845 | `20261109141845_tasks_completed_at.sql` | 1212 | 1213 | `0069044216ece2f9c10d1ffe8a6bdcae` | `ec618fa17e2b64739324cdf28117f388` |

## Ordering and dependency note

- These seven migrations precede the first migration currently present in `main`, `20261104144827_temporarily_block_client_quiz_table_access.sql`.
- `20261105161922_schedule_sweep_stuck_reservations.sql` calls `private.sweep_stuck_reservations(100)`. The defining migration `20261105123204_credit_reservation_rpcs.sql` is present on `audit/live-schema-tests` but absent from `main`.
- This branch restores only the seven missing source files. A clean rebuild from `main` plus these seven files is not yet certified; the dependency must be handled separately after review. The audit branch is not merged or copied into this recovery branch.

## Safety and validation status

- No live schema changes, migration applications, storage changes, or deployments were performed.
- No changes were made to `main`.
- This PR is a draft and is not merged.
- SQL source was retrieved directly from migration history; local PostgreSQL rebuild tests were not run by this assistant in this step.
- MD5 values above are fingerprints of exact source statement text and normalized file text. They are integrity checks, not security signatures.