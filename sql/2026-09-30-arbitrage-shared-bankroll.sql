-- REVIEW ONLY: separate owner approval required before production application.
-- Additive migration. Original bets, legacy wallet ledger and timestamps remain.
begin;
alter table public.user_arb_attempts add column if not exists deleted_at timestamptz;
alter table public.user_arb_legs add column if not exists checked_at timestamptz;
drop index public.user_arb_one_open_source;
create unique index user_arb_one_open_source
  on public.user_arb_attempts(user_id,source_arb_id,source_terms_md5)
  where status in ('started','partial') and deleted_at is null;
create table public.user_arb_bankroll (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opening_amount numeric(14,2) not null check(opening_amount between 0 and 100000000),
  updated_at timestamptz not null default now()
);
alter table public.user_arb_bankroll enable row level security;
revoke all on public.user_arb_bankroll from public, anon, authenticated;
grant select on public.user_arb_bankroll to authenticated;
create policy arb_bankroll_owner on public.user_arb_bankroll for select to authenticated
  using (user_id = (select auth.uid()));

-- Internal helper; callers always pass arb_require_user(), never a browser user id.
create function public.arb_pool_available(p_user uuid) returns numeric
language sql security definer set search_path = '' as $$
  select b.opening_amount + coalesce(sum(case l.status
    when 'settled' then coalesce(c.returned_amount,l.returned_amount,0)
      - coalesce(c.actual_stake,l.actual_stake,0)
    when 'placed' then -coalesce(c.actual_stake,l.actual_stake,0) else 0 end),0)
  from public.user_arb_bankroll b
  left join public.user_arb_attempts a on a.user_id=b.user_id and a.deleted_at is null
  left join public.user_arb_legs l on l.attempt_id=a.id
  left join lateral (select x.* from public.user_arb_leg_corrections x
    where x.leg_id=l.id order by x.created_at desc,x.id desc limit 1) c on true
  where b.user_id=p_user group by b.opening_amount
$$;
revoke all on function public.arb_pool_available(uuid) from public,anon,authenticated;

create function public.arb_set_bankroll(p_amount numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.arb_require_user();
begin
  if p_amount is null or p_amount < 0 or p_amount > 100000000 or p_amount<>round(p_amount,2)
    then raise exception 'invalid_opening_balance'; end if;
  insert into public.user_arb_bankroll(user_id,opening_amount) values(v_user,p_amount)
    on conflict(user_id) do update set opening_amount=excluded.opening_amount,updated_at=now();
end $$;
revoke all on function public.arb_set_bankroll(numeric) from public,anon;
grant execute on function public.arb_set_bankroll(numeric) to authenticated;

-- One serialized mutation path for shared bankroll. Placement time is immutable
-- on edits. Returned amount is the user's actual net receipt, including fees.
create function public.arb_record_leg_v2(
  p_leg_id uuid, p_action text, p_book text default null, p_odds numeric default null,
  p_stake numeric default null, p_result text default null, p_return numeric default null,
  p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.arb_require_user();
  v_attempt uuid; v_deleted timestamptz; v_state text;
  v_leg public.user_arb_legs%rowtype;
  v_open numeric;
begin
  -- Always lock bankroll, attempt, leg in this order; mutations serialize per user.
  select opening_amount into v_open from public.user_arb_bankroll
    where user_id=v_user for update;
  if not found then raise exception 'shared_bankroll_missing'; end if;
  select a.id into v_attempt from public.user_arb_attempts a
    join public.user_arb_legs l on l.attempt_id=a.id where l.id=p_leg_id and a.user_id=v_user;
  if not found then raise exception 'leg_not_owned'; end if;
  select deleted_at,status into v_deleted,v_state from public.user_arb_attempts
    where id=v_attempt for update;
  if v_deleted is not null then raise exception 'attempt_deleted'; end if;
  select * into v_leg from public.user_arb_legs where id=p_leg_id for update;
  if p_action not in ('place','settle','edit','unavailable') or p_action is null then raise exception 'invalid_action'; end if;
  if p_action in ('place','edit') and (
    nullif(btrim(p_book),'') is null or length(p_book)>100 or p_odds is null
    or p_odds<=1 or p_odds>10000 or p_stake is null or p_stake<=0
    or p_stake>1000000 or p_stake<>round(p_stake,2)) then raise exception 'invalid_leg'; end if;
  if p_action='place' then
    if v_leg.status<>'pending' or v_state not in ('started','partial')
      then raise exception 'leg_not_placeable'; end if;
    if p_result is not null or p_return is not null then raise exception 'invalid_result'; end if;
    if public.arb_pool_available(v_user)<p_stake then raise exception 'insufficient_shared_balance'; end if;
    update public.user_arb_legs set actual_book=btrim(p_book),actual_odds=p_odds,
      actual_stake=p_stake,placed_at=now(),checked_at=now(),status='placed' where id=p_leg_id;
  elsif p_action='unavailable' then
    if v_leg.status<>'pending' or v_state not in ('started','partial') then raise exception 'leg_not_markable'; end if;
    if nullif(btrim(p_reason),'') is null or length(p_reason)>500
      or (p_odds is not null and (p_odds<=1 or p_odds>10000)) then raise exception 'invalid_observation'; end if;
    update public.user_arb_legs set status='unavailable',failure_reason=btrim(p_reason),
      actual_odds=p_odds,checked_at=now() where id=p_leg_id;
  elsif p_action='settle' then
    if v_leg.status<>'placed' then raise exception 'leg_not_settleable'; end if;
    if p_result is null or p_result not in ('win','lose','void') or p_return is null
      or p_return<0 or p_return>100000000 or p_return<>round(p_return,2)
      or (p_result='lose' and p_return<>0) then raise exception 'invalid_result'; end if;
    update public.user_arb_legs set status='settled',result=p_result,
      returned_amount=p_return,settled_at=now() where id=p_leg_id;
  else
    if v_leg.status not in ('placed','settled') then raise exception 'leg_not_correctable'; end if;
    if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'reason_required'; end if;
    if (v_leg.status='placed' and (p_result is not null or p_return is not null))
      or (v_leg.status='settled' and (p_result is null or p_result not in ('win','lose','void')
        or p_return is null or p_return<0 or p_return>100000000 or p_return<>round(p_return,2)
        or (p_result='lose' and p_return<>0))) then raise exception 'invalid_result'; end if;
    insert into public.user_arb_leg_corrections(user_id,leg_id,reason,actual_book,
      actual_odds,actual_stake,result,returned_amount)
      values(v_user,p_leg_id,btrim(p_reason),btrim(p_book),p_odds,p_stake,p_result,p_return);
  end if;
  -- Editing a settled receipt must supersede earlier receipt corrections too.
  if p_action='settle' and exists(select 1 from public.user_arb_leg_corrections where leg_id=p_leg_id) then
    insert into public.user_arb_leg_corrections(user_id,leg_id,reason,actual_book,actual_odds,actual_stake,result,returned_amount)
      select v_user,p_leg_id,'Tulos kirjattu',c.actual_book,c.actual_odds,c.actual_stake,p_result,p_return
      from public.user_arb_leg_corrections c where c.leg_id=p_leg_id order by c.created_at desc,c.id desc limit 1;
  end if;
  update public.user_arb_attempts set status=case
    when exists(select 1 from public.user_arb_legs where attempt_id=v_attempt and status='pending') then 'partial'
    when exists(select 1 from public.user_arb_legs where attempt_id=v_attempt and status='placed') then
      case when exists(select 1 from public.user_arb_legs where attempt_id=v_attempt and status='unavailable') then 'partial' else 'placed' end
    when exists(select 1 from public.user_arb_legs where attempt_id=v_attempt and status='unavailable') then 'failed'
    else 'settled' end,
    finished_at=case when not exists(select 1 from public.user_arb_legs where attempt_id=v_attempt
      and status in ('pending','placed')) then coalesce(finished_at,now()) else null end
    where id=v_attempt;
end $$;
revoke all on function public.arb_record_leg_v2(uuid,text,text,numeric,numeric,text,numeric,text) from public,anon;
grant execute on function public.arb_record_leg_v2(uuid,text,text,numeric,numeric,text,numeric,text) to authenticated;

create function public.arb_set_attempt_deleted(p_attempt_id uuid,p_deleted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.arb_require_user();
begin
  if p_deleted is null then raise exception 'invalid_action'; end if;
  perform 1 from public.user_arb_bankroll where user_id=v_user for update;
  update public.user_arb_attempts set deleted_at=case when p_deleted then now() else null end
    where id=p_attempt_id and user_id=v_user;
  if not found then raise exception 'attempt_not_owned'; end if;
end $$;
revoke all on function public.arb_set_attempt_deleted(uuid,boolean) from public,anon;
grant execute on function public.arb_set_attempt_deleted(uuid,boolean) to authenticated;
commit;
