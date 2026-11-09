-- Local-only behaviour/isolation tests for the Qatar academic catalog migration.
-- Run inside a throwaway DB; everything is rolled back. Prints PASS/FAIL lines.
\set ON_ERROR_STOP off
begin;
create temp table res(name text, ok boolean);
grant all on res to public;
insert into auth.users(id) values ('aaaaaaaa-0000-0000-0000-000000000001'),('bbbbbbbb-0000-0000-0000-000000000002') on conflict do nothing;
create or replace function pg_temp.chk(n text, ok boolean) returns void language sql as $$ insert into res values (n, coalesce(ok,false)) $$;

-- 1. anon has no access; authenticated is read-only
set local role anon;
do $$ begin begin perform 1 from public.academic_catalog_courses limit 1; perform pg_temp.chk('anon cannot select catalog', false); exception when insufficient_privilege then perform pg_temp.chk('anon cannot select catalog', true); end; end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin begin insert into public.academic_catalog_courses(institution_id,name_ar,name_en,education_level,source_url,source_name,source_checked_at) select id,'x','x','undergraduate','u','n',current_date from public.academic_catalog_institutions limit 1; perform pg_temp.chk('authenticated cannot insert courses', false); exception when insufficient_privilege then perform pg_temp.chk('authenticated cannot insert courses', true); end; end $$;
do $$ begin begin update public.academic_catalog_courses set name_en='hacked'; perform pg_temp.chk('authenticated cannot update courses', false); exception when insufficient_privilege then perform pg_temp.chk('authenticated cannot update courses', true); end; end $$;
do $$ begin begin delete from public.academic_catalog_courses; perform pg_temp.chk('authenticated cannot delete courses', false); exception when insufficient_privilege then perform pg_temp.chk('authenticated cannot delete courses', true); end; end $$;

-- 2. draft rows are not readable by clients
select pg_temp.chk('draft courses invisible via table', (select count(*) from public.academic_catalog_courses where verification_status<>'verified')=0);
select pg_temp.chk('verified courses visible', (select count(*) from public.academic_catalog_courses)>100);

-- 3. search behaviour
select pg_temp.chk('search by code finds ACCT', (select count(*) from public.search_academic_catalog('ACCT','QA','higher',null,20))>0);
select pg_temp.chk('search English name', (select count(*) from public.search_academic_catalog('Accounting','QA',null,null,20))>0);
select pg_temp.chk('search Arabic name', (select count(*) from public.search_academic_catalog('محاسبة','QA',null,null,20))>0);
select pg_temp.chk('limit clamps to 50', (select count(*) from public.search_academic_catalog('','QA',null,null,1000))<=50);
select pg_temp.chk('literal % does not match everything', (select count(*) from public.search_academic_catalog('%','QA',null,null,50)) < (select count(*) from public.search_academic_catalog('','QA',null,null,50)) or (select count(*) from public.search_academic_catalog('%','QA',null,null,50))=0);
select pg_temp.chk('higher level: first result is not school', (select education_level<>'school' from public.search_academic_catalog('','QA','higher',null,5) limit 1));
select pg_temp.chk('other country returns nothing', (select count(*) from public.search_academic_catalog('','US',null,null,20))=0);

-- 4. subjects from catalog: ownership + duplicates
do $$
declare cid uuid; tid uuid := gen_random_uuid(); ok boolean;
begin
  select id into cid from public.academic_catalog_courses where course_code is not null limit 1;
  insert into public.subjects(user_id,name,catalog_course_id) values ('aaaaaaaa-0000-0000-0000-000000000001','From catalog',cid);
  perform pg_temp.chk('user can add catalog subject for self', true);
  begin insert into public.subjects(user_id,name,catalog_course_id) values ('aaaaaaaa-0000-0000-0000-000000000001','Dup',cid); perform pg_temp.chk('duplicate catalog subject (no term) blocked', false);
  exception when unique_violation then perform pg_temp.chk('duplicate catalog subject (no term) blocked', true); end;
  begin insert into public.subjects(user_id,name,catalog_course_id) values ('bbbbbbbb-0000-0000-0000-000000000002','Spoof',cid); perform pg_temp.chk('cannot insert subject for another user', false);
  exception when others then perform pg_temp.chk('cannot insert subject for another user', sqlstate in ('42501')); end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.chk('other user does not see my subjects', (select count(*) from public.subjects)=0);
reset role;
select name, case when ok then 'PASS' else 'FAIL' end, '' from res;
select 'summary: '||count(*) filter (where ok)||' passed, '||count(*) filter (where not ok)||' failed' from res;
rollback;
