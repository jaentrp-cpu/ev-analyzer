-- Vedox: account-scoped value-bet skips with cross-device realtime sync.
-- Run in Supabase before publishing the matching frontend build.

create table if not exists public.user_value_bet_skips (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_bet_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_bet_id)
);

alter table public.user_value_bet_skips enable row level security;
alter table public.user_value_bet_skips replica identity full;

revoke all on public.user_value_bet_skips from anon;
grant select, insert, delete on public.user_value_bet_skips to authenticated;

drop policy if exists "user_value_bet_skips_select_own" on public.user_value_bet_skips;
create policy "user_value_bet_skips_select_own"
on public.user_value_bet_skips for select to authenticated
using (user_id = auth.uid());

drop policy if exists "user_value_bet_skips_insert_own" on public.user_value_bet_skips;
create policy "user_value_bet_skips_insert_own"
on public.user_value_bet_skips for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_value_bet_skips_delete_own" on public.user_value_bet_skips;
create policy "user_value_bet_skips_delete_own"
on public.user_value_bet_skips for delete to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_value_bet_skips'
  ) then
    alter publication supabase_realtime add table public.user_value_bet_skips;
  end if;
end
$$;
