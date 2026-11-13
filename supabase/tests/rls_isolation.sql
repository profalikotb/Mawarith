-- RLS isolation test. Run against a Supabase/Postgres instance with the migration applied:
--   psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql
-- Expected output: three NOTICE lines ending with "OK". Any EXCEPTION means isolation failed.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;

-- user A creates a case
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into public.cases (id, title) values ('10000000-0000-0000-0000-000000000001', 'A case');
insert into public.case_versions (case_id, input, engine_version, ruleset_version)
  values ('10000000-0000-0000-0000-000000000001', '{"x":1}', '1.0.0', 'EG-1.0.0');

-- user B must not see or touch it
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.cases) <> 0 then raise exception 'B can read A cases'; end if;
  raise notice 'read isolation OK';
end $$;
do $$ begin
  update public.cases set title = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
  if found then raise exception 'B updated A case'; end if;
  raise notice 'update isolation OK';
end $$;
do $$ begin
  begin
    insert into public.case_versions (case_id, input, engine_version, ruleset_version)
      values ('10000000-0000-0000-0000-000000000001', '{"x":2}', '1.0.0', 'EG-1.0.0');
    raise exception 'B inserted a version into A case';
  exception when insufficient_privilege or check_violation then
    raise notice 'insert isolation OK';
  end;
end $$;

rollback;
