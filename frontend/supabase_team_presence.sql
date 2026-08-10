-- Vedox: shared-account team presence (AJ / Leo / Jalo)
-- Run once in Supabase SQL Editor before publishing the frontend.
-- Each authenticated Vedox account can read and change only its own three rows.

create table if not exists public.team_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  member_key text not null check (member_key in ('AJ', 'Leo', 'Jalo')),
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, member_key)
);

alter table public.team_presence enable row level security;

revoke all on public.team_presence from anon;
grant select, insert, update on public.team_presence to authenticated;

drop policy if exists "team_presence_select_own" on public.team_presence;
create policy "team_presence_select_own"
on public.team_presence
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "team_presence_insert_own" on public.team_presence;
create policy "team_presence_insert_own"
on public.team_presence
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "team_presence_update_own" on public.team_presence;
create policy "team_presence_update_own"
on public.team_presence
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
