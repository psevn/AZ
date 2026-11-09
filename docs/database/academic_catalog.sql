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

alter table public.academic_catalog_institutions
  drop constraint if exists academic_catalog_institutions_institution_type_check;
alter table public.academic_catalog_institutions
  add constraint academic_catalog_institutions_institution_type_check
  check (institution_type in ('ministry','school','university','college','institute','academy'));

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

-- Official ministry directory for 2026-2027: 7 public and 19 private institutions.
-- Military sub-academies are also indexed separately under the military university umbrella.
insert into public.academic_catalog_institutions
  (country_code, slug, institution_type, name_ar, name_en, source_url, source_name, source_checked_at)
values
  ('QA','community-college-qatar','college','كلية المجتمع في قطر','Community College of Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','qatar-aeronautical-academy','academy','أكاديمية قطر لعلوم الطيران','Qatar Aeronautical Academy','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','tamim-military-university','university','جامعة تميم بن حمد للعلوم العسكرية والتقنية','Tamim Bin Hamad University for Military Science and Technology','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','joaan-defense-academy','academy','أكاديمية جوعان بن جاسم للدراسات الدفاعية','Joaan Bin Jassim Academy for Defense Studies','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','police-academy','academy','أكاديمية الشرطة','Police Academy','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','ahmed-bin-mohamed-military-college','college','كلية أحمد بن محمد العسكرية','Ahmed Bin Mohamed Military College','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','al-zaeem-air-college','college','كلية الزعيم محمد بن عبد الله العطية الجوية','Al-Zaeem Mohammed Bin Abdullah Al-Attiyah Air College','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','mohammed-bin-ghanim-naval-academy','academy','أكاديمية محمد بن غانم الغانم البحرية','Mohammed Bin Ghanim Al-Ghanim Naval Academy','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','cyber-space-academy','academy','أكاديمية الفضاء السيبراني','Cyber Space Academy','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','georgetown-qatar','university','جامعة جورجتاون في قطر','Georgetown University in Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','northwestern-qatar','university','جامعة نورث وسترن في قطر','Northwestern University in Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','vcuarts-qatar','university','جامعة فرجينيا كومنولث كلية فنون التصميم في قطر','Virginia Commonwealth University School of the Arts in Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','weill-cornell-qatar','college','كلية طب وايل كورنيل في قطر','Weill Cornell Medicine - Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','carnegie-mellon-qatar','university','جامعة كارنيجي ميلون في قطر','Carnegie Mellon University in Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','hec-paris-doha','institute','جامعة الدراسات العليا لإدارة الأعمال HEC Paris الدوحة','HEC Paris in Qatar','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','doha-institute','institute','معهد الدوحة للدراسات العليا','Doha Institute for Graduate Studies','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','lusail-university','university','جامعة لوسيل','Lusail University','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','al-rayyan-international-university-college','college','كلية الريان الجامعية الدولية','Al Rayyan International University College - University of Derby partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','afg-aberdeen','college','كلية AFG بالشراكة مع جامعة أبردين','AFG College - University of Aberdeen partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','university-foundation-college','college','كلية التأسيس الجامعي','University Foundation College','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','city-university-qatar','university','سيتي يونيفرسيتي قطر بالشراكة مع جامعة أولستر','City University Qatar - Ulster University partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','oryx-university','university','جامعة أوريكس بالشراكة مع جامعة ليفربول جون مورس','Oryx University - Liverpool John Moores University partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','global-studies-institute','institute','المعهد العالمي للدراسات','Global Studies Institute (GSI)','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','mie-sppu','institute','معهد MIE-SPPU للتعليم العالي','MIE-SPPU Higher Education Institute','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','ukm-qatar','university','الجامعة الوطنية الماليزية - قطر','The National University of Malaysia - Qatar (UKM Qatar)','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','barzan-university-college','college','كلية برزان الجامعية','Barzan University College - Swinburne University partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09'),
  ('QA','qatar-finance-business-academy','academy','أكاديمية قطر للمال والأعمال','Qatar Finance and Business Academy - Northumbria University partnership','https://www.edu.gov.qa/en/Content/HigherEducationinQatar','Qatar Ministry - Higher Education in Qatar 2026-2027',date '2026-11-09')
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
  (institution_id, curriculum_id, course_code, name_ar, name_en, aliases, education_level, academic_year, source_url, source_name, source_checked_at, verification_status)
select
  i.id, cur.id, null, 'المهارات الحياتية والمهنية', 'Life and Vocational Skills',
  array['Life Skills','Vocational Skills']::text[], 'school', '2026-2027',
  'https://www.edu.gov.qa/en/News/Details/18921000',
  'Qatar Ministry - Updated Subjects for 2026-2027', date '2026-11-09', 'verified'
from public.academic_catalog_institutions i
join public.academic_catalog_curricula cur
  on cur.country_code='QA' and cur.slug='qa-national-curriculum' and cur.version_label='2026-2027'
where i.country_code='QA' and i.slug='qa-moehe'
  and not exists (
    select 1 from public.academic_catalog_courses existing
    where existing.institution_id=i.id and existing.curriculum_id=cur.id
      and lower(existing.name_en)=lower('Life and Vocational Skills')
  );

-- HBKU 2026-2027: seed actual course records, not just subject-prefix labels.
-- Course codes, titles, credits, and descriptions are taken from the official catalog pages.
insert into public.academic_catalog_courses
  (institution_id, course_code, name_ar, name_en, aliases, education_level, academic_year,
   credit_hours, description_en, source_url, source_name, source_checked_at, verification_status)
select
  i.id, seed.course_code, seed.name_ar, seed.name_en, seed.aliases, 'higher', '2026-2027',
  seed.credit_hours, seed.description_en,
  seed.source_url, seed.source_name, date '2026-11-09', 'verified'
from (values
  ('AIE 610','الأخلاقيات الإسلامية: مدخل إلى المجال','Islamic Ethics: Mapping the Field',array['Islamic Ethics']::text[],3::numeric,'This course covers key concepts, theoretical principles, and doctrines of Islamic Ethics.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 611','مناهج البحث ومصادره في الأخلاقيات','Research Methods and Sources on Ethics',array[]::text[],3::numeric,'The course teaches students to work with major sources and methodological approaches in ethics research, with a focus on research-based writing.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 630','الأخلاقيات النصية: الأخلاق في القرآن والسنة','Scriptural Ethics: Ethics in Quran and Sunna',array[]::text[],3::numeric,'This course examines approaches to the Quran and Hadith as major scriptural sources in Islam and analyzes their moral teachings.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 631','الأخلاقيات اللاهوتية والفلسفية','Theological and Philosophical Ethics',array[]::text[],3::numeric,'A survey of ethics in Islamic theology and philosophy, including classical and contemporary moral philosophy.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 632','الاستدلال الأخلاقي واتخاذ القرار','Ethical Reasoning and Moral Decision-Making',array[]::text[],3::numeric,'This course examines ethical reasoning, its principles and priorities, and critical analysis of ethical judgments in applied case studies.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 633','الأخلاقيات الحيوية الإسلامية','Islamic Bioethics',array[]::text[],3::numeric,'An engagement with Islamic bioethics and the ethical questions raised by biomedical sciences, planetary health, climate change, and environmental concerns.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 634','أخلاقيات الهجرة وحقوق الإنسان','Ethics of Migration and Human Rights',array[]::text[],3::numeric,'This course analyzes Islamic and contemporary ethical perspectives on forced and voluntary migration and international human and labor rights.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 635','أخلاقيات الأعمال','Business Ethics',array[]::text[],3::numeric,'The course covers theoretical and applied business ethics, comparing Western business ethics, Islamic tradition, and contemporary Islamic economics.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 636','أخلاقيات السلام والحرب والسياسة','Peace, War and Political Ethics',array[]::text[],3::numeric,'This course introduces Islamic ethics in politics, peace, and war from historical, contemporary, and comparative perspectives.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 637','النوع الاجتماعي والأخلاقيات الإسلامية','Gender and Islamic Ethics',array[]::text[],3::numeric,'This course examines gender research, theories of gender, and contemporary gender issues through ethical and Islamic perspectives.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 640','الأخلاقيات الإسلامية للأوبئة','Islamic Ethics of Pandemics',array[]::text[],3::numeric,'This course develops critical engagement with ethical discourse on pandemics, including historical discussions and contemporary case studies.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 641','الأخلاقيات الإسلامية والذكاء الاصطناعي','Islamic Ethics and Artificial Intelligence',array['AI Ethics']::text[],3::numeric,'This course focuses on moral questions raised by artificial intelligence, governance, philosophical foundations, and applied ethical issues.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 660','دراسة موجهة','Tutorial',array[]::text[],3::numeric,'One-on-one supervised reading and discussion of key writings in Islamic Ethics.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 661','تدريب عملي','Internship',array[]::text[],3::numeric,'A tailored internship program connected to students’ future work plans and approved institutions.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('AIE 695','ساعات رسالة الماجستير','Master''s Thesis Hours',array['Thesis']::text[],null::numeric,'Master’s thesis research hours.','https://catalog.hbku.edu.qa/course-descriptions/aie/','HBKU Academic Catalog 2026-2027'),
  ('BIOL 101','الأحياء','Biology',array['Biological Sciences']::text[],3::numeric,'An introduction to fundamental principles of biology, with a focus on biochemistry and molecular biology for undergraduate engineering students.','https://catalog.hbku.edu.qa/course-descriptions/biol/','HBKU Academic Catalog')
) as seed(course_code,name_ar,name_en,aliases,credit_hours,description_en,source_url,source_name)
join public.academic_catalog_institutions i on i.country_code='QA' and i.slug='hbku'
where not exists (
  select 1 from public.academic_catalog_courses existing
  where existing.institution_id=i.id and existing.course_code=seed.course_code
);

-- Qatar University: source-backed course records from the official Core Curriculum
-- Packages page. These are selectable catalog courses, not a claim that every
-- program requires each course. The page's live catalog year is not hard-coded here.
insert into public.academic_catalog_courses
  (institution_id, course_code, name_ar, name_en, aliases, education_level,
   credit_hours, source_url, source_name, source_checked_at, verification_status)
select
  i.id, seed.course_code, seed.name_ar, seed.name_en, seed.aliases, 'undergraduate',
  seed.credit_hours, seed.source_url, seed.source_name, date '2026-11-09', 'verified'
from (values
  ('ARAB 100','اللغة العربية 1','Arabic I',array['Arabic']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ARAB 109','المهارات اللغوية','Language Skills',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ARAB 110','مقدمة في الأدب واللغة','Introduction to Literature and Language',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ARAB 200','اللغة العربية 2','Arabic II',array['Arabic']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('DAWA 111','الثقافة الإسلامية','Islamic Culture',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 110','اللغة الإنجليزية 1','English I',array['English']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 111','اللغة الإنجليزية 2','English II',array['English']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 150','كتابة المقال 1','Essay Writing I',array['Academic Writing']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 151','الفهم القرائي المتقدم','Advanced Reading Comprehension',array['Reading']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 202','اللغة الإنجليزية 1 - ما بعد التأسيسي','English Language I - Post Foundation',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('ENGL 203','اللغة الإنجليزية 2 - ما بعد التأسيسي','English Language II - Post Foundation',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('HIST 121','تاريخ قطر','History of Qatar',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('PSYC 201','أساسيات علم النفس','Fundamentals of Psychology',array['Psychology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('PSYC 206','مقدمة في علم النفس الاجتماعي','Introduction to Social Psychology',array['Social Psychology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('SOCI 120','مقدمة في علم الاجتماع','Introduction to Sociology',array['Sociology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('SOCI 121','مقدمة في الأنثروبولوجيا','Introduction to Anthropology',array['Anthropology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('SOWO 101','مقدمة في العمل الاجتماعي والرعاية','Introduction to Social Work and Welfare',array['Social Work']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('BIOL 101','الأحياء 1','Biology I',array['Biology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('BIOL 110','الأحياء البشرية','Human Biology',array[]::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('CHEM 101','الكيمياء العامة 1','General Chemistry I',array['Chemistry']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('GEOL 101','مبادئ علم الجيولوجيا','Principles of Geology',array['Geology']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('GSCN 100','العلوم من أجل الحياة','Science for Life',array['Science']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MATH 101','التفاضل والتكامل 1','Calculus I',array['Mathematics']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MATH 103','الجبر المتوسط','Intermediate Algebra',array['Mathematics']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MATH 104','الهندسة الأساسية والقياسات','Basic Geometry and Measures',array['Geometry']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MATH 105','الرياضيات في المجتمع','Mathematics in Society',array['Mathematics']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('GEOG 110','الجغرافيا العامة','General Geography',array['Geography']::text[],3::numeric,'https://qataruniversity-prd.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('CHME 100','الطاقة من أجل الحياة','Energy for Life',array['Energy']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('CMPS 185','مقدمة في الأمن السيبراني','Introduction to Cybersecurity',array['Cybersecurity']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('DAWA 117','الأخلاقيات','Ethics',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('DAWA 118','مقدمة في دراسات العقيدة الإسلامية','Introduction to Islamic Creed Studies',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('DAWA 210','فلسفة السيرة','Philosophy of Sirah',array['Sirah']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('GENG 104','السلامة المرورية والسلوك الإنساني','Traffic Safety and Human Behaviour',array['Traffic Safety']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('LAWC 100','الثقافة القانونية','Legal Culture',array['Law']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('LAWC 102','حقوق الإنسان','Human Rights',array[]::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MAGT 100','مقدمة في إدارة الأعمال','Introduction to Business',array['Business']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('MAGT 201','عقلية ريادة الأعمال والابتكار','Entrepreneurial and Innovation Mindset',array['Entrepreneurship']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('UNIV 100','ندوة السنة الأولى','First Year Seminar',array['First Year']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages'),
  ('UNIV 230','الذكاء الاصطناعي في التعليم الجامعي','Artificial Intelligence in University Education',array['Artificial Intelligence','AI']::text[],3::numeric,'https://www.qu.edu.qa/en-us/core/student-information/packages','Qatar University Core Curriculum Packages')
) as seed(course_code,name_ar,name_en,aliases,credit_hours,source_url,source_name)
join public.academic_catalog_institutions i on i.country_code='QA' and i.slug='qatar-university'
where not exists (
  select 1 from public.academic_catalog_courses existing
  where existing.institution_id=i.id and existing.course_code=seed.course_code
);
