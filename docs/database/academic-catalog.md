# Qatar-first academic catalog

## Purpose

AZ's academic catalog is a shared, source-attributed directory of institutions, curricula, programs, and courses. It is separate from each student's private `subjects` rows.

A student adds a catalog course by creating a private `subjects` row with `catalog_course_id`. Existing tasks, documents, notes, and progress continue to reference that private subject. A student-created custom subject leaves `catalog_course_id` null.

## Data model

- `academic_catalog_institutions`: schools, universities, colleges, and education authorities, keyed by ISO-style country code plus stable slug.
- `academic_catalog_curricula`: national, international, or institution-specific curriculum editions.
- `academic_catalog_programs`: institution-specific degree or study programs.
- `academic_catalog_courses`: verified courses with optional institution program/curriculum links, course code, Arabic/English names, aliases, level/grade, academic year, and source provenance.
- `subjects.catalog_course_id`: optional link from a student's private subject to the shared catalog.

The schema is country-neutral. Qatar is the first dataset, not a hard-coded country restriction. School curricula can be linked to the relevant curriculum without assuming every Qatar school follows the national curriculum. Institution-specific courses must not be added until their official source has been checked.

## Current verified seed scope

- Qatar Ministry of Education and Higher Education: five core K-12 subjects supported by the Ministry's curriculum-standards mandate, plus Life and Vocational Skills from the Ministry's 2026-2027 update.
- Hamad Bin Khalifa University: eight subject/code entries surfaced by its 2026-2027 course-descriptions directory. These are broad catalog entries; do not present them as section offerings or degree-plan requirements.
- Qatar University and University of Doha for Science and Technology: institution records are present, but individual courses are intentionally not seeded yet. Import them only from their official catalog data and retain the academic-year/source information.

Every seeded course stores a source URL, source label, and date checked. The dataset is a starter set, not a complete Qatar-wide catalog.

## Security

- Catalog tables enable RLS and allow authenticated users to read only.
- No client insert/update/delete policy is created for catalog data. Trusted migrations/admin ingestion own catalog writes.
- The search RPC is SECURITY INVOKER and executable only by authenticated users.
- Explicit SELECT grants are included because new public tables are not automatically exposed through Supabase's Data API.
- Student subjects retain the existing owner-only RLS policy. Catalog linking does not make student-owned files or progress public.

## Migration workflow

This SQL is a reviewed schema/seed draft, not a migration applied to the hosted project. Before applying it:

1. Generate the migration filename with the installed Supabase CLI in the local repository: `supabase migration new qatar_first_academic_catalog`.
2. Copy the SQL from `academic_catalog.sql` into the generated migration file.
3. Review the generated diff and run the migration against a disposable/local database first.
4. Run type checks, app tests, and Supabase security/performance advisors.
5. Apply to the hosted project only after explicit approval.

The Courses UI now expects `search_academic_catalog` and `subjects.catalog_course_id`; therefore, deploy the reviewed migration before enabling this UI in a live environment.
