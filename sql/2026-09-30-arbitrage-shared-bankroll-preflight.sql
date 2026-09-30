-- Read-only catalog checks. No user rows, bets or credentials returned.
select
  to_regclass('public.user_arb_attempts') is not null as attempts_exist,
  to_regclass('public.user_arb_legs') is not null as legs_exist,
  to_regclass('public.user_arb_leg_corrections') is not null as corrections_exist,
  to_regprocedure('public.arb_require_user()') is not null as owner_guard_exists,
  to_regclass('public.user_arb_one_open_source') is not null as old_index_exists,
  to_regclass('public.user_arb_bankroll') is null as new_table_not_installed,
  to_regprocedure('public.arb_record_leg_v2(uuid,text,text,numeric,numeric,text,numeric,text)') is null as new_rpc_not_installed;
