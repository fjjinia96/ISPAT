-- ============================================================
-- ISPAT হালচাল : database setup
-- Supabase > SQL Editor > New query > paste ALL of this > Run
-- Safe to run again: it will not delete your data.
-- ============================================================

-- 1. The table that holds the dashboard data (one row, id = 'current')
create table if not exists public.dashboard (
  id          text primary key,
  data        jsonb not null,
  source      text,
  hash        text,
  updated_at  timestamptz not null default now()
);

-- 2. Lock the table: only the team account may read or change it
alter table public.dashboard enable row level security;

revoke all on public.dashboard from anon;
grant select, insert, update on public.dashboard to authenticated;

create or replace function public.is_ispat_team()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- The shared team login. Must match loginDomain in docs/js/config.js
  select coalesce(lower(auth.jwt() ->> 'email') = 'ispat@ispat-halchal.app', false);
$$;

drop policy if exists "team can read"   on public.dashboard;
drop policy if exists "team can add"    on public.dashboard;
drop policy if exists "team can update" on public.dashboard;

create policy "team can read" on public.dashboard
  for select to authenticated
  using (public.is_ispat_team());

create policy "team can add" on public.dashboard
  for insert to authenticated
  with check (public.is_ispat_team() and id = 'current');

create policy "team can update" on public.dashboard
  for update to authenticated
  using (public.is_ispat_team())
  with check (public.is_ispat_team() and id = 'current');

-- 3. Live updates: the app refreshes by itself when the data changes
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dashboard'
  ) then
    alter publication supabase_realtime add table public.dashboard;
  end if;
end $$;

-- Done! You should see "Success. No rows returned".
