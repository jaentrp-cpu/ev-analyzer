-- REVIEW ONLY. Apply in Supabase SQL Editor only after a separate production approval.
-- Public offers remain in public.arbitrages. These tables contain only each user's own
-- actions; they do not replace the scanner, EV bets, or real bookmaker balances.
begin;

create table if not exists public.user_arb_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_arb_id text,
  source_updated_at timestamptz,
  source_terms_md5 text not null,
  offer_snapshot jsonb not null,
  previous_attempt_id uuid references public.user_arb_attempts(id),
  started_at timestamptz,
  finished_at timestamptz,
  status text not null check (status in ('started','partial','placed','rejected','abandoned','settled','failed')),
  reason text,
  created_at timestamptz not null default now(),
  constraint user_arb_started_state check (
    (status = 'rejected' and started_at is null) or
    (status <> 'rejected' and started_at is not null)
  )
);
create index if not exists user_arb_attempts_owner_created
  on public.user_arb_attempts(user_id, created_at desc, id desc);
create unique index if not exists user_arb_one_open_source
  on public.user_arb_attempts(user_id, source_arb_id, source_terms_md5)
  where status in ('started','partial');

create table if not exists public.user_arb_legs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.user_arb_attempts(id) on delete cascade,
  ordinal integer not null check (ordinal between 0 and 2),
  offered_book text not null,
  offered_outcome text not null,
  offered_odds numeric not null check (offered_odds > 1),
  actual_book text,
  actual_odds numeric check (actual_odds > 1),
  actual_stake numeric(14,2) check (actual_stake > 0),
  placed_at timestamptz,
  status text not null default 'pending' check (status in ('pending','unavailable','placed','settled')),
  failure_reason text,
  result text check (result in ('win','lose','void')),
  returned_amount numeric(14,2) check (returned_amount >= 0),
  settled_at timestamptz,
  unique(attempt_id, ordinal)
);

create table if not exists public.user_arb_wallets (
  user_id uuid not null references auth.users(id) on delete cascade,
  bookmaker text not null,
  opening_balance numeric(14,2) not null check (opening_balance >= 0),
  -- Corrections may expose a historical deficit. New placements still require
  -- sufficient balance; a correction must not silently erase the deficit.
  balance numeric(14,2) not null,
  created_at timestamptz not null default now(),
  primary key(user_id, bookmaker)
);
create table if not exists public.user_arb_leg_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  leg_id uuid not null references public.user_arb_legs(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  actual_book text not null,
  actual_odds numeric not null check (actual_odds > 1),
  actual_stake numeric(14,2) not null check (actual_stake > 0),
  result text check (result in ('win','lose','void')),
  returned_amount numeric(14,2) check (returned_amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists user_arb_leg_corrections_leg_created
  on public.user_arb_leg_corrections(leg_id, created_at desc, id desc);
create index if not exists user_arb_leg_corrections_owner_created
  on public.user_arb_leg_corrections(user_id, created_at desc, id desc);
create table if not exists public.user_arb_cash_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bookmaker text not null,
  leg_id uuid references public.user_arb_legs(id) on delete cascade,
  correction_id uuid references public.user_arb_leg_corrections(id) on delete cascade,
  kind text not null check (kind in ('opening','stake','return','correction')),
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);
create unique index if not exists user_arb_one_base_cash_entry
  on public.user_arb_cash_entries(leg_id, kind)
  where kind in ('stake','return');
create unique index if not exists user_arb_one_correction_per_book
  on public.user_arb_cash_entries(correction_id, bookmaker)
  where kind = 'correction';
create index if not exists user_arb_cash_owner_created
  on public.user_arb_cash_entries(user_id, created_at desc);

create table if not exists public.user_arb_analytics_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  founder_aggregate_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_arb_attempts enable row level security;
alter table public.user_arb_legs enable row level security;
alter table public.user_arb_wallets enable row level security;
alter table public.user_arb_leg_corrections enable row level security;
alter table public.user_arb_cash_entries enable row level security;
alter table public.user_arb_analytics_consent enable row level security;

revoke all on public.user_arb_attempts, public.user_arb_legs,
  public.user_arb_wallets, public.user_arb_leg_corrections,
  public.user_arb_cash_entries,
  public.user_arb_analytics_consent from anon, authenticated;
grant select on public.user_arb_attempts, public.user_arb_legs,
  public.user_arb_wallets, public.user_arb_leg_corrections,
  public.user_arb_cash_entries,
  public.user_arb_analytics_consent to authenticated;
create policy arb_attempt_owner on public.user_arb_attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy arb_leg_owner on public.user_arb_legs for select to authenticated
  using (exists (select 1 from public.user_arb_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())));
create policy arb_wallet_owner on public.user_arb_wallets for select to authenticated
  using (user_id = (select auth.uid()));
create policy arb_correction_owner on public.user_arb_leg_corrections for select to authenticated
  using (user_id = (select auth.uid()));
create policy arb_cash_owner on public.user_arb_cash_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy arb_consent_owner on public.user_arb_analytics_consent for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.arb_require_user() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists (
    select 1 from public.profiles p where p.id = v_user
      and p.tier_code in ('rookie_sure','pro_sure','all_star')
  ) then raise exception 'arb_access_denied' using errcode = '42501'; end if;
  return v_user;
end $$;
revoke all on function public.arb_require_user() from public, anon;
grant execute on function public.arb_require_user() to authenticated;

create or replace function public.arb_set_opening_balance(p_book text, p_amount numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := public.arb_require_user();
begin
  if nullif(btrim(p_book),'') is null or length(p_book) > 100
    or p_amount is null or p_amount < 0 or p_amount > 100000000
    or p_amount <> round(p_amount, 2)
  then raise exception 'invalid_opening_balance'; end if;
  insert into public.user_arb_wallets(user_id, bookmaker, opening_balance, balance)
    values (v_user, btrim(p_book), p_amount, p_amount);
  insert into public.user_arb_cash_entries(user_id, bookmaker, kind, amount)
    values (v_user, btrim(p_book), 'opening', p_amount);
end $$;
revoke all on function public.arb_set_opening_balance(text,numeric) from public, anon;
grant execute on function public.arb_set_opening_balance(text,numeric) to authenticated;

create or replace function public.arb_create_attempt(
  p_offer_id text, p_expected_updated_at timestamptz,
  p_reject_reason text default null, p_previous_attempt uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_offer public.arbitrages%rowtype;
  v_id uuid;
  v_legs jsonb;
  v_leg jsonb;
  v_ord integer;
  v_previous jsonb;
  v_previous_fingerprint text;
  v_fingerprint text;
begin
  select * into v_offer from public.arbitrages where id = p_offer_id
    and aktiivinen is true;
  if not found then raise exception 'offer_not_active'; end if;
  if p_expected_updated_at is null or v_offer.paivitetty is distinct from p_expected_updated_at
    then raise exception 'offer_changed_refresh_required'; end if;
  v_fingerprint := pg_catalog.md5(coalesce(
    nullif(to_jsonb(v_offer) ->> 'arb_key', ''), v_offer.outcomes_json::text));
  if p_previous_attempt is not null then
    select offer_snapshot, source_terms_md5 into v_previous, v_previous_fingerprint
      from public.user_arb_attempts
      where id = p_previous_attempt and user_id = v_user;
    if not found then raise exception 'previous_attempt_not_owned'; end if;
    if v_fingerprint = v_previous_fingerprint
      or nullif(v_previous ->> 'event_id','') is null
      or v_previous ->> 'event_id' is distinct from to_jsonb(v_offer) ->> 'event_id'
      or v_previous ->> 'markkina' is distinct from to_jsonb(v_offer) ->> 'markkina'
      or coalesce(v_previous ->> 'line','') is distinct from
         coalesce(to_jsonb(v_offer) ->> 'line','')
    then raise exception 'replacement_not_same_market'; end if;
  end if;
  v_legs := v_offer.outcomes_json::jsonb;
  if jsonb_typeof(v_legs) <> 'array' or jsonb_array_length(v_legs) not between 2 and 3
  then raise exception 'invalid_offer_legs'; end if;
  insert into public.user_arb_attempts (
    user_id, source_arb_id, source_updated_at, source_terms_md5, offer_snapshot,
    previous_attempt_id, started_at, status, reason
  ) values (
    v_user, p_offer_id, v_offer.paivitetty, v_fingerprint, to_jsonb(v_offer),
    p_previous_attempt,
    case when nullif(btrim(p_reject_reason),'') is null then now() else null end,
    case when nullif(btrim(p_reject_reason),'') is null then 'started' else 'rejected' end,
    nullif(left(btrim(p_reject_reason),500),'')
  ) returning id into v_id;
  for v_ord in 0..jsonb_array_length(v_legs)-1 loop
    v_leg := v_legs -> v_ord;
    insert into public.user_arb_legs(
      attempt_id, ordinal, offered_book, offered_outcome, offered_odds
    ) values (
      v_id, v_ord,
      coalesce(nullif(v_leg ->> 'book',''), nullif(v_leg ->> 'kirja',''), '?'),
      coalesce(nullif(v_leg ->> 'outcome',''), nullif(v_leg ->> 'kohde',''),
        nullif(v_leg ->> 'side',''), '?'),
      coalesce(nullif(v_leg ->> 'odds',''), v_leg ->> 'kerroin')::numeric
    );
  end loop;
  return v_id;
end $$;
revoke all on function public.arb_create_attempt(text,timestamptz,text,uuid) from public, anon;
grant execute on function public.arb_create_attempt(text,timestamptz,text,uuid) to authenticated;

create or replace function public.arb_place_leg(
  p_leg_id uuid, p_book text, p_odds numeric, p_stake numeric
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_leg public.user_arb_legs%rowtype;
  v_attempt public.user_arb_attempts%rowtype;
begin
  select l.* into v_leg from public.user_arb_legs l join public.user_arb_attempts a
    on a.id = l.attempt_id where l.id = p_leg_id and a.user_id = v_user for update of l;
  if not found then raise exception 'leg_not_owned'; end if;
  select * into v_attempt from public.user_arb_attempts where id = v_leg.attempt_id for update;
  if v_leg.status <> 'pending' or v_attempt.status not in ('started','partial')
  then raise exception 'leg_not_placeable'; end if;
  if nullif(btrim(p_book),'') is null or length(p_book) > 100 or p_odds is null
    or p_odds <= 1 or p_odds > 10000 or p_stake is null or p_stake <= 0
    or p_stake > 1000000 or p_stake <> round(p_stake, 2)
    then raise exception 'invalid_leg'; end if;
  update public.user_arb_wallets set balance = balance - p_stake
    where user_id = v_user and bookmaker = btrim(p_book) and balance >= p_stake;
  if not found then raise exception 'insufficient_virtual_balance'; end if;
  update public.user_arb_legs set actual_book = btrim(p_book),
    actual_odds = p_odds, actual_stake = p_stake, placed_at = now(), status = 'placed'
    where id = p_leg_id;
  insert into public.user_arb_cash_entries(user_id, bookmaker, leg_id, kind, amount)
    values(v_user, btrim(p_book), p_leg_id, 'stake', -p_stake);
  update public.user_arb_attempts set status =
    case when not exists (select 1 from public.user_arb_legs
      where attempt_id = v_leg.attempt_id and status not in ('placed','settled'))
      then 'placed' else 'partial' end
    where id = v_leg.attempt_id;
end $$;
revoke all on function public.arb_place_leg(uuid,text,numeric,numeric) from public, anon;
grant execute on function public.arb_place_leg(uuid,text,numeric,numeric) to authenticated;

create or replace function public.arb_mark_leg_unavailable(
  p_leg_id uuid, p_reason text, p_actual_odds numeric default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := public.arb_require_user(); v_attempt uuid; v_status text;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'reason_required'; end if;
  if p_actual_odds is not null and (p_actual_odds <= 1 or p_actual_odds > 10000)
    then raise exception 'invalid_odds'; end if;
  select l.attempt_id into v_attempt from public.user_arb_legs l
    join public.user_arb_attempts a on a.id = l.attempt_id
    where l.id = p_leg_id and a.user_id = v_user and l.status = 'pending'
      and a.status in ('started','partial') for update of l;
  if not found then raise exception 'leg_not_markable'; end if;
  select status into v_status from public.user_arb_attempts
    where id = v_attempt for update;
  if v_status not in ('started','partial') then raise exception 'attempt_not_open'; end if;
  update public.user_arb_legs set status = 'unavailable',
    failure_reason = left(btrim(p_reason),500), actual_odds = p_actual_odds
    where id = p_leg_id;
  update public.user_arb_attempts set
    status = case when not exists (select 1 from public.user_arb_legs
      where attempt_id = v_attempt and status in ('pending','placed'))
      then 'failed' else 'partial' end,
    finished_at = case when not exists (select 1 from public.user_arb_legs
      where attempt_id = v_attempt and status in ('pending','placed'))
      then now() else finished_at end
    where id = v_attempt;
end $$;
revoke all on function public.arb_mark_leg_unavailable(uuid,text,numeric) from public, anon;
grant execute on function public.arb_mark_leg_unavailable(uuid,text,numeric) to authenticated;

create or replace function public.arb_settle_leg(p_leg_id uuid, p_result text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_leg public.user_arb_legs%rowtype;
  v_correction public.user_arb_leg_corrections%rowtype;
  v_return numeric;
  v_book text;
  v_stake numeric;
  v_odds numeric;
begin
  select l.* into v_leg from public.user_arb_legs l join public.user_arb_attempts a
    on a.id = l.attempt_id where l.id = p_leg_id and a.user_id = v_user for update of l;
  if not found or v_leg.status <> 'placed' or p_result is null
    or p_result not in ('win','lose','void')
  then raise exception 'leg_not_settleable'; end if;
  perform 1 from public.user_arb_attempts where id = v_leg.attempt_id for update;
  select * into v_correction from public.user_arb_leg_corrections
    where leg_id = p_leg_id order by created_at desc, id desc limit 1;
  v_book := coalesce(v_correction.actual_book, v_leg.actual_book);
  v_stake := coalesce(v_correction.actual_stake, v_leg.actual_stake);
  v_odds := coalesce(v_correction.actual_odds, v_leg.actual_odds);
  v_return := case p_result when 'win' then round(v_stake * v_odds, 2)
    when 'void' then v_stake else 0 end;
  update public.user_arb_legs set status = 'settled', result = p_result,
    returned_amount = v_return, settled_at = now() where id = p_leg_id;
  update public.user_arb_wallets set balance = balance + v_return
    where user_id = v_user and bookmaker = v_book;
  if not found then raise exception 'virtual_wallet_missing'; end if;
  insert into public.user_arb_cash_entries(user_id, bookmaker, leg_id, kind, amount)
    values(v_user, v_book, p_leg_id, 'return', v_return);
  if not exists(select 1 from public.user_arb_legs where attempt_id = v_leg.attempt_id
    and status in ('placed','pending')) then
    update public.user_arb_attempts set status =
      case when exists (select 1 from public.user_arb_legs
        where attempt_id = v_leg.attempt_id and status = 'unavailable')
        then 'failed' else 'settled' end,
      finished_at = now()
      where id = v_leg.attempt_id;
  end if;
end $$;
revoke all on function public.arb_settle_leg(uuid,text) from public, anon;
grant execute on function public.arb_settle_leg(uuid,text) to authenticated;

create or replace function public.arb_correct_leg(
  p_leg_id uuid, p_reason text, p_book text, p_odds numeric,
  p_stake numeric, p_result text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_leg public.user_arb_legs%rowtype;
  v_last public.user_arb_leg_corrections%rowtype;
  v_old_book text; v_old_odds numeric; v_old_stake numeric;
  v_old_result text; v_old_return numeric;
  v_new_book text; v_new_return numeric;
  v_old_delta numeric; v_new_delta numeric;
  v_wallet_book text; v_wallet_count integer := 0;
  v_correction_id uuid;
begin
  select l.* into v_leg from public.user_arb_legs l
    join public.user_arb_attempts a on a.id = l.attempt_id
    where l.id = p_leg_id and a.user_id = v_user for update of l;
  if not found or v_leg.status not in ('placed','settled')
    then raise exception 'leg_not_correctable'; end if;
  if nullif(btrim(p_reason),'') is null or length(btrim(p_reason)) > 500
    or nullif(btrim(p_book),'') is null or length(p_book) > 100
    or p_odds is null or p_odds <= 1 or p_odds > 10000
    or p_stake is null or p_stake <= 0 or p_stake > 1000000
    or p_stake <> round(p_stake, 2)
    then raise exception 'invalid_correction'; end if;
  if (v_leg.status = 'placed' and p_result is not null)
    or (v_leg.status = 'settled' and
      (p_result is null or p_result not in ('win','lose','void')))
    then raise exception 'invalid_correction_result'; end if;
  select * into v_last from public.user_arb_leg_corrections
    where leg_id = p_leg_id order by created_at desc, id desc limit 1;
  v_old_book := coalesce(v_last.actual_book, v_leg.actual_book);
  v_old_odds := coalesce(v_last.actual_odds, v_leg.actual_odds);
  v_old_stake := coalesce(v_last.actual_stake, v_leg.actual_stake);
  v_old_result := coalesce(v_last.result, v_leg.result);
  v_old_return := coalesce(v_last.returned_amount, v_leg.returned_amount, 0);
  v_new_book := btrim(p_book);
  v_new_return := case when v_leg.status = 'settled' then
    case p_result when 'win' then round(p_stake * p_odds, 2)
      when 'void' then p_stake else 0 end else 0 end;
  if v_old_book = v_new_book and v_old_odds = p_odds
    and v_old_stake = p_stake and v_old_result is not distinct from p_result
    then raise exception 'correction_has_no_change'; end if;
  for v_wallet_book in select bookmaker from public.user_arb_wallets
      where user_id = v_user and bookmaker in (v_old_book, v_new_book)
      order by bookmaker for update loop
    v_wallet_count := v_wallet_count + 1;
  end loop;
  if v_wallet_count <> (case when v_old_book = v_new_book then 1 else 2 end)
    then raise exception 'virtual_wallet_missing'; end if;
  insert into public.user_arb_leg_corrections(
    user_id, leg_id, reason, actual_book, actual_odds, actual_stake,
    result, returned_amount
  ) values (
    v_user, p_leg_id, btrim(p_reason), v_new_book, p_odds, p_stake,
    p_result, case when v_leg.status = 'settled' then v_new_return else null end
  ) returning id into v_correction_id;
  v_old_delta := v_old_stake - v_old_return;
  v_new_delta := -p_stake + v_new_return;
  if v_old_book = v_new_book then
    v_new_delta := v_old_delta + v_new_delta;
    update public.user_arb_wallets set balance = balance + v_new_delta
      where user_id = v_user and bookmaker = v_new_book;
    if v_new_delta <> 0 then
      insert into public.user_arb_cash_entries(
        user_id, bookmaker, leg_id, correction_id, kind, amount
      ) values (v_user, v_new_book, p_leg_id, v_correction_id, 'correction', v_new_delta);
    end if;
  else
    update public.user_arb_wallets set balance = balance + v_old_delta
      where user_id = v_user and bookmaker = v_old_book;
    update public.user_arb_wallets set balance = balance + v_new_delta
      where user_id = v_user and bookmaker = v_new_book;
    if v_old_delta <> 0 then
      insert into public.user_arb_cash_entries(
        user_id, bookmaker, leg_id, correction_id, kind, amount
      ) values (v_user, v_old_book, p_leg_id, v_correction_id, 'correction', v_old_delta);
    end if;
    if v_new_delta <> 0 then
      insert into public.user_arb_cash_entries(
        user_id, bookmaker, leg_id, correction_id, kind, amount
      ) values (v_user, v_new_book, p_leg_id, v_correction_id, 'correction', v_new_delta);
    end if;
  end if;
  return v_correction_id;
end $$;
revoke all on function public.arb_correct_leg(uuid,text,text,numeric,numeric,text) from public, anon;
grant execute on function public.arb_correct_leg(uuid,text,text,numeric,numeric,text) to authenticated;

create or replace function public.arb_close_attempt(p_attempt_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := public.arb_require_user();
begin
  update public.user_arb_attempts set status = 'abandoned', finished_at = now(),
    reason = nullif(left(btrim(p_reason),500),'')
    where id = p_attempt_id and user_id = v_user and status in ('started','partial')
      and not exists (select 1 from public.user_arb_legs
        where attempt_id = p_attempt_id and status = 'placed');
  if not found then raise exception 'attempt_not_closeable_with_open_legs'; end if;
end $$;
revoke all on function public.arb_close_attempt(uuid,text) from public, anon;
grant execute on function public.arb_close_attempt(uuid,text) to authenticated;

create or replace function public.arb_set_analytics_consent(p_opt_in boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := public.arb_require_user();
begin
  if p_opt_in is null then raise exception 'consent_required'; end if;
  insert into public.user_arb_analytics_consent(user_id, founder_aggregate_opt_in)
    values(v_user, p_opt_in)
    on conflict(user_id) do update set founder_aggregate_opt_in = excluded.founder_aggregate_opt_in,
      updated_at = now();
end $$;
revoke all on function public.arb_set_analytics_consent(boolean) from public, anon;
grant execute on function public.arb_set_analytics_consent(boolean) to authenticated;
commit;
