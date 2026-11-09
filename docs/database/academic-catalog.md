# Qatar-first academic catalog

## Purpose

AZ's academic catalog is a shared, source-attributed directory of institutions, curricula, programs, and courses. It is separate from each student's private `subjects` rows.

A student adds a catalog course by creating a private `subjects` row with `catalog_course_id`. Existing tasks, documents, notes, and progress continue to reference that private subject. A student-created custom subject leaves `catalog_course_id` null.

## Data model

- `academic_catalog_institutions`: schools, universities, colleges, institutes, academies, and education authorities, keyed by ISO-style country code plus stable slug.
- `academic_catalog_curricula`: national, international, or institution-specific curriculum editions.
- `academic_catalog_programs`: institution-specific degree or study programs.
- `academic_catalog_courses`: verified courses with optional institution program/curriculum links, course code, Arabic/English names, aliases, level/grade, academic year, and source provenance.
- `subjects.catalog_course_id`: optional link from a student's private subject to the shared catalog.

The schema is country-neutral. Qatar is the first dataset, not a hard-coded country restriction. School curricula can be linked to the relevant curriculum without assuming every Qatar school follows the national curriculum. For the initial Qatar school dataset, use the Ministry of Education and Higher Education as the sole authority/source family; do not build separate school-by-school or private-school curriculum imports in this phase.

## Qatar higher-education institution coverage

The official Ministry of Education and Higher Education directory for academic year 2026-2027 lists **7 public and 19 private higher-education institutions**. The SQL seed indexes all 26 top-level entries. It also indexes the four named military sub-institutions under Tamim Bin Hamad University for discoverability; those are nested entities and do not increase the ministry's 7-public count.

### Public institutions (7)

1. Qatar University
2. Community College of Qatar
3. Qatar Aeronautical Academy
4. University of Doha for Science and Technology
5. Tamim Bin Hamad University for Military Science and Technology
6. Joaan Bin Jassim Academy for Defense Studies
7. Police Academy

Tamim Bin Hamad's listed components are also indexed as subordinate discoverable entities: Ahmed Bin Mohamed Military College, Al-Zaeem Mohammed Bin Abdullah Al-Attiyah Air College, Mohammed Bin Ghanim Al-Ghanim Naval Academy, and Cyber Space Academy.

### Private institutions (19)

1. Hamad Bin Khalifa University
2. Georgetown University in Qatar
3. Northwestern University in Qatar
4. Virginia Commonwealth University School of the Arts in Qatar
5. Weill Cornell Medicine - Qatar
6. Carnegie Mellon University in Qatar
7. HEC Paris in Qatar
8. Doha Institute for Graduate Studies
9. Lusail University
10. Al Rayyan International University College (University of Derby partnership)
11. AFG College (University of Aberdeen partnership)
12. University Foundation College
13. City University Qatar (Ulster University partnership)
14. Oryx University (Liverpool John Moores University partnership)
15. Global Studies Institute (GSI)
16. MIE-SPPU Higher Education Institute
17. The National University of Malaysia - Qatar (UKM Qatar)
18. Barzan University College (Swinburne University partnership)
19. Qatar Finance and Business Academy (Northumbria University partnership)

The Ministry page also identifies teaching locations for specific higher-education programs. Those are not counted as additional universities/institutions and should be represented as delivery locations/program relationships if needed, not duplicated as independent institutions.

### Course-level verification status

- HBKU: eight subject/code entries are currently seeded from its official 2026-2027 course-descriptions directory. These are broad catalog entries, not section offerings or degree-plan requirements.
- Qatar University: institution is indexed; course import should use the current 2026-2027 undergraduate catalog and official graduate sources where available. Older catalogs must not be treated as current.
- UDST and the other listed institutions: institution records are indexed, but no individual courses are invented. Import course records only after checking the institution's official current catalog/program pages.
- The institution directory is complete against the Ministry's 2026-2027 listing; course coverage is intentionally partial and must be tracked per institution/source/year.

## School dataset

- Use Ministry of Education and Higher Education curriculum and subject sources only for the Qatar school starter set.
- Seed only subjects supported by current Ministry references, and retain the academic year/source date.
- Do not assume all private schools follow the Qatar national curriculum; however, separate imports of private-school or international curricula are outside this agreed initial scope.

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
