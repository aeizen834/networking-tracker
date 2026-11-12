-- Network Tracker database setup.
-- Run once in Supabase: SQL Editor -> New query -> paste this -> Run.
--
-- One table holds everything. Each row is one record from a "collection"
-- (people, interactions, snoozes) and belongs to the signed-in user who wrote it.
-- Row Level Security makes the database itself refuse to show or change
-- anyone else's rows, which is what keeps the public site key safe.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null check (collection in ('people', 'interactions', 'snoozes')),
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.records enable row level security;

drop policy if exists "Read own records" on public.records;
drop policy if exists "Add own records" on public.records;
drop policy if exists "Change own records" on public.records;
drop policy if exists "Delete own records" on public.records;

create policy "Read own records" on public.records
  for select to authenticated using (user_id = auth.uid());

create policy "Add own records" on public.records
  for insert to authenticated with check (user_id = auth.uid());

create policy "Change own records" on public.records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Delete own records" on public.records
  for delete to authenticated using (user_id = auth.uid());

-- Signed-out visitors get nothing; signed-in users get only what the policies above allow.
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;
