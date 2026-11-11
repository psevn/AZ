do $guard$
begin
  if exists (select 1 from public.ai_usage_log) then
    raise exception 'ai_usage_log is not empty; aborting (request_key would need a backfill)';
  end if;
end
$guard$;

alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free', 'pro')),
  add column deletion_requested_at timestamptz;

alter table public.subjects add column exam_date date;

alter table public.tasks
  add column note text check (note is null or char_length(note) <= 5000);

alter table public.documents
  add column sha256 text,
  add column page_count integer check (page_count is null or page_count >= 0),
  add column kind text not null default 'other' check (kind in ('slides', 'notes', 'past_exam', 'other')),
  add column failed_reason text,
  add column attempts integer not null default 0 check (attempts >= 0),
  add column locked_at timestamptz,
  add column processed_at timestamptz,
  add constraint documents_user_sha256_key unique (user_id, sha256);

alter table public.ai_usage_log
  alter column model drop not null,
  add column request_key text not null,
  add column status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed', 'refunded')),
  add column provider text,
  add column prompt_version text,
  add column credits_reserved numeric not null default 0,
  add column credits_charged numeric not null default 0,
  add column latency_ms integer,
  add column result_ref text,
  add column error text,
  add column updated_at timestamptz not null default now(),
  add constraint ai_usage_log_request_unique unique (user_id, feature, request_key);

revoke select on public.ai_usage_log from authenticated;
grant select (id, user_id, feature, status, credits_charged, created_at) on public.ai_usage_log to authenticated;

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  page_no integer not null check (page_no >= 1),
  text text not null default '',
  unique (document_id, page_no),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);
create index document_pages_user_idx on public.document_pages (user_id);
create index document_pages_document_user_idx on public.document_pages (document_id, user_id);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  content text not null,
  source_pages integer[] not null default '{}',
  provider text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);
create index summaries_user_idx on public.summaries (user_id);
create index summaries_document_user_idx on public.summaries (document_id, user_id);

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null check (period_type in ('day', 'month')),
  period_start date not null,
  credits_used numeric not null default 0 check (credits_used >= 0),
  credits_reserved numeric not null default 0 check (credits_reserved >= 0),
  primary key (user_id, period_type, period_start)
);

create table public.spend_counters (
  month date primary key,
  reserved_cost numeric(14, 6) not null default 0 check (reserved_cost >= 0),
  settled_cost numeric(14, 6) not null default 0 check (settled_cost >= 0)
);

create table public.usage_limits (
  plan text primary key check (plan in ('free', 'pro')),
  daily_credits numeric not null default 0 check (daily_credits >= 0),
  monthly_credits numeric not null default 0 check (monthly_credits >= 0)
);

create table public.credit_costs (
  feature text primary key,
  credits numeric not null check (credits >= 0)
);

create table public.app_config (
  key text primary key,
  value jsonb not null
);

insert into public.usage_limits (plan, daily_credits, monthly_credits) values ('free', 0, 0), ('pro', 0, 0);
insert into public.app_config (key, value) values
  ('global_monthly_cost_cap', '0'::jsonb),
  ('max_reserved_age_minutes', '10'::jsonb);

alter table public.document_pages enable row level security;
alter table public.summaries enable row level security;
alter table public.usage_counters enable row level security;
alter table public.spend_counters enable row level security;
alter table public.usage_limits enable row level security;
alter table public.credit_costs enable row level security;
alter table public.app_config enable row level security;

revoke all on public.document_pages, public.summaries, public.usage_counters, public.spend_counters,
  public.usage_limits, public.credit_costs, public.app_config from anon, authenticated;

grant select on public.document_pages, public.summaries, public.usage_counters,
  public.usage_limits, public.credit_costs to authenticated;

create policy document_pages_read_own on public.document_pages
  for select to authenticated using (user_id = (select auth.uid()));
create policy summaries_read_own on public.summaries
  for select to authenticated using (user_id = (select auth.uid()));
create policy usage_counters_read_own on public.usage_counters
  for select to authenticated using (user_id = (select auth.uid()));
create policy usage_limits_read on public.usage_limits
  for select to authenticated using (true);
create policy credit_costs_read on public.credit_costs
  for select to authenticated using (true);

drop policy if exists documents_select_own on storage.objects;
drop policy if exists documents_insert_own on storage.objects;
drop policy if exists documents_update_own on storage.objects;
drop policy if exists documents_delete_own on storage.objects;
update storage.buckets set file_size_limit = 20971520 where id = 'documents';
