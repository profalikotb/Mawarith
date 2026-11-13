-- حساب المواريث الشرعية — optional cloud storage
-- Every row belongs to exactly one auth user; RLS denies all cross-user access.

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'مسألة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  input jsonb not null,
  note text,
  engine_version text not null,
  ruleset_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists case_versions_case_idx on public.case_versions(case_id, created_at desc);

alter table public.cases enable row level security;
alter table public.case_versions enable row level security;
alter table public.cases force row level security;
alter table public.case_versions force row level security;

-- cases: owner-only
create policy cases_select on public.cases for select using (owner = auth.uid());
create policy cases_insert on public.cases for insert with check (owner = auth.uid());
create policy cases_update on public.cases for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy cases_delete on public.cases for delete using (owner = auth.uid());

-- versions: owner-only, and the parent case must belong to the same owner
create policy versions_select on public.case_versions for select using (owner = auth.uid());
create policy versions_insert on public.case_versions for insert
  with check (owner = auth.uid() and exists (select 1 from public.cases c where c.id = case_id and c.owner = auth.uid()));
create policy versions_delete on public.case_versions for delete using (owner = auth.uid());
-- versions are immutable: no update policy

revoke all on public.cases, public.case_versions from anon;
grant select, insert, update, delete on public.cases to authenticated;
grant select, insert, delete on public.case_versions to authenticated;
