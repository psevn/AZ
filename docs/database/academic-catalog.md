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
- `subjects.term_id`: link to the student's academic term. The Courses UI requires an active term before adding a catalog course; the same catalog course can be added once per term, and a later term creates a separate private subject row. The database column remains nullable for compatibility with existing/custom subjects and legacy rows.

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

- **Qatar University:** 39 individual course records are seeded from the University's official Core Curriculum Packages page. They include course codes, titles, Arabic display names, credit hours, and source attribution. They are catalog options, not a claim that every program requires every course. The course-page source does not provide a single consistent catalog-year label for all entries, so `academic_year` is left unset rather than guessed. The 2026-2027 undergraduate catalog is linked separately as the current program/catalog reference.
- **HBKU:** 15 individual Applied Islamic Ethics (AIE) courses are seeded from its official 2026-2027 Course Descriptions page, including course codes, titles, credits where specified, and concise descriptions. Other subject areas remain to be imported; subject-prefix listings are not treated as individual courses.
- **UDST:** one verified course, `DCMP2010A — Introduction to Journalism`, is seeded from the official 2026-2027 catalog, including its description and credits.
- **Northwestern University in Qatar:** 40 distinct course entries are seeded from the official Fall 2026 timetable/course-information PDF. Multiple class sections are collapsed into one course entry; distinct seminar titles that share a course number remain separate. The seed is a partial extraction from the 14-page term document, not a complete NU-Q catalog.
- **Other institutions:** institution records are indexed, but course coverage is not yet imported. VCUarts Qatar publishes its degree bulletins and explains that its Qatar campus offers a smaller selection than the home campus; Northwestern's Education City cross-registration page notes that Georgetown course schedules are no longer public. Do not infer or invent course codes/titles from program names. Import only after checking the institution's official current catalog/program pages.
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

This SQL is the reviewed schema/seed source for the generated migration `20261109130000_qatar_first_academic_catalog.sql`. It has not been applied to the hosted project. Before applying it:

1. Generate the migration filename with the installed Supabase CLI in the local repository: `supabase migration new qatar_first_academic_catalog`.
2. Copy the SQL from `academic_catalog.sql` into the generated migration file.
3. Review the generated diff and run the migration against a disposable/local database first.
4. Run type checks, app tests, and Supabase security/performance advisors.
5. Apply to the hosted project only after explicit approval.

The Courses UI expects `search_academic_catalog`, `subjects.catalog_course_id`, and the optional `subjects.term_id`. Apply the reviewed catalog migration before enabling this UI in a live environment.


### Onboarding institution selection

- The academic onboarding identity step loads the Qatar institution directory from `academic_catalog_institutions` and offers an Arabic/English datalist for universities, colleges, and higher-education providers. Students can type to filter or keep a custom institution name if it is not listed.
- For school learners, the school name remains optional so setup is not blocked by manual entry. AZ uses the Ministry-backed Qatar National Curriculum dataset for the school-subject starter catalog. The onboarding links to the Ministry's official school directory for students who want to identify their exact school.
- The picker depends on the catalog schema being applied. Until then, the field remains usable as a manual text entry; the hosted Supabase database has not been changed.
