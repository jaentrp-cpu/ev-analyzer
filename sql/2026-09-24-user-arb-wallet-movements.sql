-- REVIEW ONLY. Run separately in the existing Vedox Supabase project after approval.
-- Manual virtual-wallet movements are append-only and never edit arb bet entries.
begin;

alter table public.user_arb_cash_entries
  add column if not exists note text,
  add column if not exists operation_id uuid,
  add column if not exists balance_after numeric(14,2);

alter table public.user_arb_cash_entries
  drop constraint if exists user_arb_cash_entries_kind_check;
alter table public.user_arb_cash_entries
  add constraint user_arb_cash_entries_kind_check
  check (kind in (
    'opening', 'stake', 'return', 'correction',
    'deposit', 'withdrawal', 'transfer_out', 'transfer_in', 'reconcile'
  ));

create unique index if not exists user_arb_cash_operation_kind
  on public.user_arb_cash_entries(operation_id, kind)
  where operation_id is not null;

create or replace function public.arb_adjust_wallet(
  p_book text, p_kind text, p_amount numeric, p_reason text, p_request_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_book text := btrim(p_book);
  v_old_balance numeric(14,2);
  v_new_balance numeric(14,2);
  v_delta numeric(14,2);
begin
  if nullif(v_book, '') is null or length(v_book) > 100
    or p_kind is null or p_kind not in ('deposit', 'withdrawal', 'reconcile')
    or p_amount is null or p_amount > 100000000
    or p_amount <> round(p_amount, 2)
    or (p_kind = 'reconcile' and p_amount < 0)
    or (p_kind <> 'reconcile' and p_amount <= 0)
    or nullif(btrim(p_reason), '') is null or length(p_reason) > 500
    or p_request_id is null
  then raise exception 'invalid_wallet_movement'; end if;

  select balance into v_old_balance from public.user_arb_wallets
    where user_id = v_user and bookmaker = v_book for update;
  if not found then raise exception 'virtual_wallet_missing'; end if;

  v_delta := case p_kind
    when 'deposit' then p_amount
    when 'withdrawal' then -p_amount
    else p_amount - v_old_balance
  end;
  if v_delta = 0 then raise exception 'wallet_balance_unchanged'; end if;
  if p_kind = 'withdrawal' and v_old_balance < p_amount
    then raise exception 'insufficient_virtual_balance'; end if;

  update public.user_arb_wallets set balance = balance + v_delta
    where user_id = v_user and bookmaker = v_book
    returning balance into v_new_balance;
  insert into public.user_arb_cash_entries(
    user_id, bookmaker, kind, amount, note, operation_id, balance_after
  ) values (
    v_user, v_book, p_kind, v_delta, btrim(p_reason), p_request_id, v_new_balance
  );
  return p_request_id;
end $$;
revoke all on function public.arb_adjust_wallet(text,text,numeric,text,uuid) from public, anon;
grant execute on function public.arb_adjust_wallet(text,text,numeric,text,uuid) to authenticated;

create or replace function public.arb_transfer_wallet(
  p_from_book text, p_to_book text, p_amount numeric, p_reason text, p_request_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := public.arb_require_user();
  v_from text := btrim(p_from_book);
  v_to text := btrim(p_to_book);
  v_wallet record;
  v_from_balance numeric(14,2);
  v_found_from boolean := false;
  v_found_to boolean := false;
  v_from_after numeric(14,2);
  v_to_after numeric(14,2);
begin
  if nullif(v_from, '') is null or nullif(v_to, '') is null
    or v_from = v_to or length(v_from) > 100 or length(v_to) > 100
    or p_amount is null or p_amount <= 0 or p_amount > 100000000
    or p_amount <> round(p_amount, 2)
    or nullif(btrim(p_reason), '') is null or length(p_reason) > 500
    or p_request_id is null
  then raise exception 'invalid_wallet_movement'; end if;

  -- Deterministic lock order prevents opposing transfers from deadlocking.
  for v_wallet in select bookmaker, balance from public.user_arb_wallets
      where user_id = v_user and bookmaker in (v_from, v_to)
      order by bookmaker for update loop
    if v_wallet.bookmaker = v_from then
      v_found_from := true;
      v_from_balance := v_wallet.balance;
    else
      v_found_to := true;
    end if;
  end loop;
  if not v_found_from or not v_found_to
    then raise exception 'virtual_wallet_missing'; end if;
  if v_from_balance < p_amount
    then raise exception 'insufficient_virtual_balance'; end if;

  update public.user_arb_wallets set balance = balance - p_amount
    where user_id = v_user and bookmaker = v_from
    returning balance into v_from_after;
  update public.user_arb_wallets set balance = balance + p_amount
    where user_id = v_user and bookmaker = v_to
    returning balance into v_to_after;
  insert into public.user_arb_cash_entries(
    user_id, bookmaker, kind, amount, note, operation_id, balance_after
  ) values
    (v_user, v_from, 'transfer_out', -p_amount, btrim(p_reason), p_request_id, v_from_after),
    (v_user, v_to, 'transfer_in', p_amount, btrim(p_reason), p_request_id, v_to_after);
  return p_request_id;
end $$;
revoke all on function public.arb_transfer_wallet(text,text,numeric,text,uuid) from public, anon;
grant execute on function public.arb_transfer_wallet(text,text,numeric,text,uuid) to authenticated;

commit;
