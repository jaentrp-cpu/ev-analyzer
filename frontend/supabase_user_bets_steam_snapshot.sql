begin;

alter table public.user_bets
  add column if not exists steam_snapshot jsonb;

comment on column public.user_bets.steam_snapshot is
  'Immutable Steam advisor display snapshot captured when the user adds a bet; never used for selection or staking.';

create or replace function public.preserve_user_bet_steam_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.steam_snapshot is not null
     and new.steam_snapshot is distinct from old.steam_snapshot then
    new.steam_snapshot := old.steam_snapshot;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_user_bet_steam_snapshot on public.user_bets;
create trigger preserve_user_bet_steam_snapshot
before update of steam_snapshot on public.user_bets
for each row execute function public.preserve_user_bet_steam_snapshot();

update public.user_bets as ub
set steam_snapshot = jsonb_build_object(
  'schema_version', 1,
  'captured_at', coalesce(ub.created_at, now()),
  'raw', jsonb_build_object(
    'steam_quality_score', eb.steam_quality_score,
    'steam_edge_pct', eb.steam_edge_pct,
    'signal_json', eb.signal_json
  )
)
from public.ev_bets as eb
where ub.steam_snapshot is null
  and ub.source_bet_id is not null
  and eb.id::text = ub.source_bet_id::text
  and (
    eb.steam_quality_score is not null
    or eb.steam_edge_pct is not null
    or eb.signal_json is not null
  );

commit;
