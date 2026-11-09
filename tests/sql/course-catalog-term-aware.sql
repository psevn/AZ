-- Functional checks against a disposable PostgreSQL database.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

insert into public.academic_terms (id, user_id, name, is_active) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Fall 2026',true),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Spring 2027',false),
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Fall 2026',true);

do $$
declare
  v_course_id uuid;
begin
  select id into strict v_course_id
  from public.academic_catalog_courses
  where course_code is not null
  order by course_code
  limit 1;

  -- First addition in a term succeeds.
  insert into public.subjects (user_id, name, term_id, catalog_course_id)
  values ('00000000-0000-0000-0000-000000000001','Catalog course - Fall','10000000-0000-0000-0000-000000000001',v_course_id);

  -- The same catalog course cannot be added twice in the same term.
  begin
    insert into public.subjects (user_id, name, term_id, catalog_course_id)
    values ('00000000-0000-0000-0000-000000000001','Duplicate - Fall','10000000-0000-0000-0000-000000000001',v_course_id);
    raise exception 'Expected same-term duplicate to be rejected';
  exception when unique_violation then
    null;
  end;

  -- The same catalog course can be taken in a different term.
  insert into public.subjects (user_id, name, term_id, catalog_course_id)
  values ('00000000-0000-0000-0000-000000000001','Catalog course - Spring','10000000-0000-0000-0000-000000000002',v_course_id);

  -- A no-term catalog subject is allowed once, but not twice.
  insert into public.subjects (user_id, name, term_id, catalog_course_id)
  values ('00000000-0000-0000-0000-000000000001','Catalog course - No term',null,v_course_id);

  begin
    insert into public.subjects (user_id, name, term_id, catalog_course_id)
    values ('00000000-0000-0000-0000-000000000001','Duplicate - No term',null,v_course_id);
    raise exception 'Expected no-term duplicate to be rejected';
  exception when unique_violation then
    null;
  end;

  -- A subject cannot reference another user's academic term.
  begin
    insert into public.subjects (user_id, name, term_id, catalog_course_id)
    values ('00000000-0000-0000-0000-000000000001','Cross-owner term','20000000-0000-0000-0000-000000000001',v_course_id);
    raise exception 'Expected cross-owner term reference to be rejected';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

-- Add a row owned by user 2 so the RLS assertion proves cross-user isolation.
insert into public.subjects (user_id, name, term_id)
values ('00000000-0000-0000-0000-000000000002','User 2 private subject','20000000-0000-0000-0000-000000000001');

-- RLS: user 1 sees only their own subject rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible from public.subjects;
  if v_visible <> 3 then
    raise exception 'RLS expected 3 own subjects, saw %', v_visible;
  end if;
end;
$$;
rollback;

-- Verify the catalog tables are readable to authenticated users and not writable.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.academic_catalog_institutions;
  if v_count = 0 then
    raise exception 'Expected seeded catalog institutions';
  end if;
  begin
    insert into public.academic_catalog_institutions
      (country_code, slug, institution_type, name_ar, name_en)
    values ('QA','forbidden-test-write','school','اختبار','Forbidden test write');
    raise exception 'Expected authenticated catalog write to be denied';
  exception when insufficient_privilege then
    null;
  end;
end;
$;
rollback;

select 'course catalog migration tests passed' as result;
