-- Read-only catalog verification. Run after the migration.
select
  (select relrowsecurity from pg_class where oid=to_regclass('public.user_arb_bankroll')) as bankroll_rls,
  exists(select 1 from pg_policies where schemaname='public' and tablename='user_arb_bankroll'
    and policyname='arb_bankroll_owner' and cmd='SELECT' and qual like '%uid()%') as owner_read_policy,
  has_table_privilege('authenticated','public.user_arb_bankroll','SELECT') as owner_select,
  not has_table_privilege('authenticated','public.user_arb_bankroll','INSERT') as no_direct_insert,
  not has_table_privilege('authenticated','public.user_arb_bankroll','UPDATE') as no_direct_update,
  not has_table_privilege('authenticated','public.user_arb_bankroll','DELETE') as no_direct_delete,
  not has_table_privilege('anon','public.user_arb_bankroll','SELECT') as no_anon_read,
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='user_arb_attempts' and column_name='deleted_at') as deletion_column,
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='user_arb_legs' and column_name='checked_at') as observation_column,
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='user_arb_legs' and column_name='net_return_verified') as verification_column,
  (select bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')) and count(*)=3
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('arb_set_bankroll','arb_record_leg_v2','arb_set_attempt_deleted')) as rpc_grants,
  not has_function_privilege('authenticated','public.arb_pool_available(uuid)','EXECUTE') as helper_private,
  (select indexdef like '%deleted_at IS NULL%' from pg_indexes
    where schemaname='public' and indexname='user_arb_one_open_source') as deletion_aware_index;
