-- Vedox: persist own-bet taxonomy and backfill safe historical matches.
-- Run once in the Supabase SQL Editor with an owner/service-role connection.
-- This never changes a row unless it finds a direct source ID or an
-- unambiguous match that belongs to exactly one league.
--
-- Before running, replace the empty string in the SET statement below with
-- the target user's auth.users ID.
-- Leaving it empty is safe: it updates no betting rows.

begin;

set local vedox.backfill_user_id = '';

alter table public.user_bets add column if not exists liiga text;
alter table public.user_bets add column if not exists league text;
alter table public.user_bets add column if not exists sport text;
alter table public.user_bets add column if not exists taxonomy_status text;
alter table public.user_bets add column if not exists taxonomy_reason text;

create index if not exists user_bets_source_bet_id_idx
  on public.user_bets (source_bet_id);

with target_user as (
  select nullif(current_setting('vedox.backfill_user_id', true), '')::uuid as id
),
unclassified as (
  select u.id, u.source_bet_id, u."match"
  from public.user_bets u
  join target_user t on t.id = u.user_id
  where coalesce(nullif(btrim(u.liiga), ''), nullif(btrim(u.league), '')) is null
),
direct_sources as (
  select u.id, nullif(btrim(e.liiga), '') as raw_league, 'backfilled_source_id'::text as method
  from unclassified u
  join public.ev_bets e on e.id::text = u.source_bet_id::text
  where nullif(btrim(e.liiga), '') is not null
),
clv_direct_leagues as (
  select
    u.id,
    array_agg(distinct nullif(btrim(c.liiga), ''))
      filter (where nullif(btrim(c.liiga), '') is not null) as leagues
  from unclassified u
  join public.clv_observations c on c.ev_bet_id::text = u.source_bet_id::text
  where not exists (select 1 from direct_sources d where d.id = u.id)
  group by u.id
),
clv_direct_sources as (
  select id, leagues[1] as raw_league, 'backfilled_clv_source_id'::text as method
  from clv_direct_leagues
  where cardinality(leagues) = 1
),
all_direct_sources as (
  select * from direct_sources
  union all
  select * from clv_direct_sources
),
unique_match_leagues as (
  select
    u.id,
    array_agg(distinct nullif(btrim(e.liiga), ''))
      filter (where nullif(btrim(e.liiga), '') is not null) as leagues
  from unclassified u
  join public.ev_bets e
    on lower(regexp_replace(coalesce(u."match", ''), '[^[:alnum:]]+', '', 'g'))
     = lower(regexp_replace(coalesce(e.ottelu, ''), '[^[:alnum:]]+', '', 'g'))
  where not exists (select 1 from all_direct_sources d where d.id = u.id)
  group by u.id
),
unique_match_sources as (
  select id, leagues[1] as raw_league, 'backfilled_unique_match'::text as method
  from unique_match_leagues
  where cardinality(leagues) = 1
),
resolved as (
  select * from all_direct_sources
  union all
  select * from unique_match_sources
)
update public.user_bets u
set
  liiga = r.raw_league,
  league = r.raw_league,
  sport = case
    when lower(r.raw_league) like 'soccer_%' then 'Jalkapallo'
    when lower(r.raw_league) like 'icehockey_%' then 'Jääkiekko'
    when lower(r.raw_league) like 'basketball_%' then 'Koripallo'
    when lower(r.raw_league) like 'baseball_%' then 'Baseball'
    when lower(r.raw_league) like 'americanfootball_%' then 'Amerikkalainen jalkapallo'
    when lower(r.raw_league) like 'tennis_%' then 'Tennis'
    when lower(r.raw_league) like 'handball_%' then 'Käsipallo'
    when lower(r.raw_league) like 'rugby_%' then 'Rugby League'
    when lower(r.raw_league) like 'cricket_%' then 'Cricket'
    when lower(r.raw_league) like 'mma_%' or lower(r.raw_league) like 'boxing_%' then 'Kamppailulajit'
    when lower(r.raw_league) like 'aussierules_%' then 'AFL'
    else null
  end,
  taxonomy_status = case
    when lower(r.raw_league) ~ '^(soccer|icehockey|basketball|baseball|americanfootball|tennis|handball|rugby|cricket|mma|boxing|aussierules)_' then 'backfilled'
    else 'backfilled_league_only'
  end,
  taxonomy_reason = r.method
from resolved r
where u.id = r.id;

-- Verification: shows only the selected user's taxonomy backfill totals.
select
  coalesce(taxonomy_reason, 'not_backfilled') as taxonomy_reason,
  count(*) as bets
from public.user_bets
where user_id = nullif(current_setting('vedox.backfill_user_id', true), '')::uuid
group by taxonomy_reason
order by taxonomy_reason;

commit;
