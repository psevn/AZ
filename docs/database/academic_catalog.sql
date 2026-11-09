-- Qatar-first, globally extensible academic catalog.
-- This migration is intentionally committed for review only; it is not applied to the hosted database.

create table if not exists public.academic_catalog_institutions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  slug text not null,
  institution_type text not null check (institution_type in ('ministry','school','university','college','institute')),
  name_ar text not null,
  name_en text not null,
  source_url text,
  source_name text,
  source_checked_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, slug)
);

create table if not exists public.academic_catalog_curricula (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  institution_id uuid references public.academic_catalog_institutions(id) on delete set null,
  slug text not null,
  curriculum_type text not null check (curriculum_type in ('national','international','institutional')),
  education_level text not null check (education_level in ('school','higher','diploma','undergraduate','postgraduate','doctoral')),
  name_ar text not null,
  name_en text not null,
  version_label text,
  source_url text,
  source_name text,
  source_checked_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, slug, version_label)
);

create table if not exists public.academic_catalog_programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.academic_catalog_institutions(id) on delete cascade,
  curriculum_id uuid references public.academic_catalog_curricula(id) on delete set null,
  code text,
  name_ar text not null,
  name_en text not null,
  degree_level text not null check (degree_level in ('school','certificate','diploma','associate','bachelor','master','doctoral','professional','other')),
  department_ar text,
  department_en text,
  source_url text,
  source_name text,
  source_checked_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academic_catalog_programs_institution_code_uidx
  on public.academic_catalog_programs (institution_id, lower(code))
  where code is not null;

create table if not exists public.academic_catalog_courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.academic_catalog_institutions(id) on delete cascade,
  curriculum_id uuid references public.academic_catalog_curricula(id) on delete set null,
  program_id uuid references public.academic_catalog_programs(id) on delete set null,
  course_code text,
  name_ar text not null,
  name_en text not null,
  aliases text[] not null default '{}',
  education_level text not null check (education_level in ('school','higher','diploma','undergraduate','postgraduate','doctoral')),
  grade_level text,
  academic_year text,
  term_label text,
  credit_hours numeric(4,1) check (credit_hours is null or credit_hours >= 0),
  description_ar text,
  description_en text,
  source_url text not null,
  source_name text not null,
  source_checked_at date not null,
  verification_status text not null default 'verified' check (verification_status in ('draft','verified','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_catalog_courses_country_level_idx
  on public.academic_catalog_courses (institution_id, education_level, verification_status);
create index if not exists academic_catalog_courses_code_idx
  on public.academic_catalog_courses (lower(course_code))
  where course_code is not null;
create index if not exists academic_catalog_courses_name_ar_idx
  on public.academic_catalog_courses (lower(name_ar));
create index if not exists academic_catalog_courses_name_en_idx
  on public.academic_catalog_courses (lower(name_en));
create index if not exists academic_catalog_courses_aliases_idx
  on public.academic_catalog_courses using gin (aliases);

alter table public.subjects
  add column if not exists catalog_course_id uuid
  references public.academic_catalog_courses(id) on delete set null;

create index if not exists subjects_catalog_course_id_idx
  on public.subjects (catalog_course_id)
  where catalog_course_id is not null;

create unique index if not exists subjects_user_catalog_course_uidx
  on public.subjects (user_id, catalog_course_id)
  where catalog_course_id is not null;

alter table public.academic_catalog_institutions enable row level security;
alter table public.academic_catalog_curricula enable row level security;
alter table public.academic_catalog_programs enable row level security;
alter table public.academic_catalog_courses enable row level security;

drop policy if exists academic_catalog_institutions_authenticated_read on public.academic_catalog_institutions;
create policy academic_catalog_institutions_authenticated_read
  on public.academic_catalog_institutions for select to authenticated using (true);

drop policy if exists academic_catalog_curricula_authenticated_read on public.academic_catalog_curricula;
create policy academic_catalog_curricula_authenticated_read
  on public.academic_catalog_curricula for select to authenticated using (true);

drop policy if exists academic_catalog_programs_authenticated_read on public.academic_catalog_programs;
create policy academic_catalog_programs_authenticated_read
  on public.academic_catalog_programs for select to authenticated using (true);

drop policy if exists academic_catalog_courses_authenticated_read on public.academic_catalog_courses;
create policy academic_catalog_courses_authenticated_read
  on public.academic_catalog_courses for select to authenticated using (true);

-- Explicit grants are required: new public tables are no longer automatically exposed by the Data API.
revoke all on public.academic_catalog_institutions, public.academic_catalog_curricula,
  public.academic_catalog_programs, public.academic_catalog_courses from anon, authenticated;
grant select on public.academic_catalog_institutions, public.academic_catalog_curricula,
  public.academic_catalog_programs, public.academic_catalog_courses to authenticated;

create or replace function public.search_academic_catalog(
  p_query text,
  p_country_code text default 'QA',
  p_education_level text default null,
  p_institution_query text default null,
  p_limit integer default 20
)
returns table (
  course_id uuid,
  name_ar text,
  name_en text,
  course_code text,
  education_level text,
  grade_level text,
  institution_name_ar text,
  institution_name_en text,
  curriculum_name_ar text,
  curriculum_name_en text,
  aliases text[],
  source_url text,
  source_name text,
  source_checked_at date
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.name_ar,
    c.name_en,
    c.course_code,
    c.education_level,
    c.grade_level,
    i.name_ar,
    i.name_en,
    cur.name_ar,
    cur.name_en,
    c.aliases,
    c.source_url,
    c.source_name,
    c.source_checked_at
  from public.academic_catalog_courses c
  join public.academic_catalog_institutions i on i.id = c.institution_id
  left join public.academic_catalog_curricula cur on cur.id = c.curriculum_id
  where
    c.verification_status = 'verified'
    and c.institution_id is not null
    and i.is_active = true
    and i.country_code = upper(coalesce(nullif(trim(p_country_code), ''), 'QA'))
    and (
      p_education_level is null
      or p_education_level = 'all'
      or (p_education_level = 'higher' and c.education_level <> 'school')
      or c.education_level = p_education_level
    )
    and (
      nullif(trim(coalesce(p_institution_query, '')), '') is null
      or i.name_ar ilike '%' || trim(p_institution_query) || '%'
      or i.name_en ilike '%' || trim(p_institution_query) || '%'
    )
    and (
      nullif(trim(coalesce(p_query, '')), '') is null
      or c.name_ar ilike '%' || trim(p_query) || '%'
      or c.name_en ilike '%' || trim(p_query) || '%'
      or coalesce(c.course_code, '') ilike '%' || trim(p_query) || '%'
      or exists (
        select 1 from unnest(c.aliases) alias
        where alias ilike '%' || trim(p_query) || '%'
      )
    )
  order by
    case when c.education_level = 'school' then 0 else 1 end,
    i.name_en,
    c.name_en
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_academic_catalog(text,text,text,text,integer) from public, anon;
grant execute on function public.search_academic_catalog(text,text,text,text,integer) to authenticated;

comment on table public.academic_catalog_institutions is
  'Public, source-attributed institutions for the global academic catalog; country_code identifies the jurisdiction.';
comment on table public.academic_catalog_curricula is
  'Public curriculum definitions; version_label records the academic/curriculum edition.';
comment on table public.academic_catalog_programs is
  'Institution-specific academic programs, kept separate from student-owned subjects.';
comment on table public.academic_catalog_courses is
  'Verified institution/curriculum course records. Every record must retain its authoritative source and checked date.';
comment on column public.subjects.catalog_course_id is
  'Optional link from a student-owned subject to a public catalog course. Student files, notes, tasks, and progress remain on the private subject.';

-- Verified starter records only. Qatar is the first dataset, not a schema-level restriction.
insert into public.academic_catalog_institutions
  (country_code, slug, institution_type, name_ar, name_en, source_url, source_name, source_checked_at)
values
  ('QA','qa-moehe','ministry','وزارة التربية والتعليم والتعليم العالي','Ministry of Education and Higher Education - Qatar','https://www.edu.gov.qa/en/Content/MinistryMandate','Qatar Ministry of Education and Higher Education',date '2026-11-09'),
  ('QA','qatar-university','university','جامعة قطر','Qatar University','https://www.qu.edu.qa/en-us/students/resources/Pages/catalogs.aspx','Qatar University Student Catalogs',date '2026-11-09'),
  ('QA','hbku','university','جامعة حمد بن خليفة','Hamad Bin Khalifa University','https://catalog.hbku.edu.qa/course-descriptions/','HBKU Course Descriptions 2026-2027',date '2026-11-09'),
  ('QA','udst','university','جامعة الدوحة للعلوم والتكنولوجيا','University of Doha for Science and Technology','https://www.udst.edu.qa/about-udst/institutional-excellence-ie/policies-and-procedures/academic-scheduling-procedure','UDST Academic Scheduling Procedure',date '2026-11-09')
on conflict (country_code, slug) do update set
  institution_type = excluded.institution_type,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  source_url = excluded.source_url,
  source_name = excluded.source_name,
  source_checked_at = excluded.source_checked_at,
  updated_at = now();

insert into public.academic_catalog_curricula
  (country_code, institution_id, slug, curriculum_type, education_level, name_ar, name_en, version_label, source_url, source_name, source_checked_at)
select
  'QA', i.id, 'qa-national-curriculum', 'national', 'school',
  'المنهج الوطني القطري', 'Qatar National Curriculum', '2026-2027',
  'https://www.edu.gov.qa/en/Content/CurriculumSection',
  'Qatar Ministry Curriculum Section', date '2026-11-09'
from public.academic_catalog_institutions i
where i.country_code = 'QA' and i.slug = 'qa-moehe'
on conflict (country_code, slug, version_label) do update set
  institution_id = excluded.institution_id,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  source_url = excluded.source_url,
  source_name = excluded.source_name,
  source_checked_at = excluded.source_checked_at,
  updated_at = now();

insert into public.academic_catalog_courses
  (institution_id, curriculum_id, course_code, name_ar, name_en, aliases, education_level, academic_year, source_url, source_name, source_checked_at, verification_status)
select
  i.id, cur.id, null, seed.name_ar, seed.name_en, seed.aliases, 'school', '2026-2027',
  'https://www.edu.gov.qa/en/Content/MinistryMandate',
  'Qatar Ministry of Education - Ministry Mandate (K-12 curriculum standards)', date '2026-11-09', 'verified'
from (values
  ('اللغة العربية','Arabic Language',array['Arabic','العربي']::text[]),
  ('التربية الإسلامية','Islamic Studies',array['Islamic Education','Islamic','التربية الاسلامية']::text[]),
  ('اللغة الإنجليزية','English Language',array['English','إنجليزي']::text[]),
  ('الرياضيات','Mathematics',array['Math','رياضيات']::text[]),
  ('العلوم','Science',array['General Science','علوم']::text[])
) as seed(name_ar,name_en,aliases)
join public.academic_catalog_institutions i on i.country_code='QA' and i.slug='qa-moehe'
join public.academic_catalog_curricula cur on cur.country_code='QA' and cur.slug='qa-national-curriculum' and cur.version_label='2026-2027'
where not exists (
  select 1 from public.academic_catalog_courses existing
  where existing.institution_id=i.id and existing.curriculum_id=cur.id
    and lower(existing.name_en)=lower(seed.name_en)
);

insert into public.academic_catalog_courses
  (institution_id, course_code, name_ar, name_en, aliases, education_level, academic_year, source_url, source_name, source_checked_at, verification_status)
select
  i.id, seed.course_code, seed.name_ar, seed.name_en, seed.aliases, 'higher', '2026-2027',
  'https://catalog.hbku.edu.qa/course-descriptions/',
  'HBKU Course Descriptions 2026-2027', date '2026-11-09', 'verified'
from (values
  ('AIE','الأخلاقيات الإسلامية التطبيقية','Applied Islamic Ethics',array['Islamic Ethics']::text[]),
  ('ARA','اللغة العربية','Arabic',array['Arabic Language']::text[]),
  ('BIOL','الأحياء','Biology',array['Biological Sciences']::text[]),
  ('CHEM','الكيمياء','Chemistry',array[]::text[]),
  ('CS','علوم الحاسوب','Computer Science',array['Computing']::text[]),
  ('ECON','الاقتصاد','Economics',array[]::text[]),
  ('ELEN','الهندسة الكهربائية','Electrical Engineering',array[]::text[]),
  ('ENGL','اللغة الإنجليزية','English',array['English Language']::text[])
) as seed(course_code,name_ar,name_en,aliases)
join public.academic_catalog_institutions i on i.country_code='QA' and i.slug='hbku'
where not exists (
  select 1 from public.academic_catalog_courses existing
  where existing.institution_id=i.id and existing.course_code=seed.course_code
);
