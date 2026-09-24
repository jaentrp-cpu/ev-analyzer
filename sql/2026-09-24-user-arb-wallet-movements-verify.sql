-- READ ONLY. Run only after the separate wallet-movements migration.
-- Every row should return ready = true. This checks catalog configuration,
-- not the transactional behavior of a real authenticated account.
with checks as (
  select 'column'::text as object_kind, v.name as object_name,
    exists (select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'user_arb_cash_entries'
        and c.column_name = v.name) as ready
  from (values ('note'), ('operation_id'), ('balance_after')) v(name)
  union all
  select 'constraint', 'user_arb_cash_entries_kind_check',
    exists (select 1 from pg_constraint c
      where c.conrelid = 'public.user_arb_cash_entries'::regclass
        and c.conname = 'user_arb_cash_entries_kind_check'
        and pg_get_constraintdef(c.oid) like '%transfer_out%')
  union all
  select 'index', 'user_arb_cash_operation_kind',
    to_regclass('public.user_arb_cash_operation_kind') is not null
  union all
  select 'function', v.name,
    to_regprocedure(v.signature) is not null
      and coalesce(has_function_privilege('authenticated', to_regprocedure(v.signature), 'EXECUTE'), false)
      and not coalesce(has_function_privilege('anon', to_regprocedure(v.signature), 'EXECUTE'), false)
  from (values
    ('arb_adjust_wallet', 'public.arb_adjust_wallet(text,text,numeric,text,uuid)'),
    ('arb_transfer_wallet', 'public.arb_transfer_wallet(text,text,numeric,text,uuid)')
  ) v(name, signature)
  union all
  select 'rls', 'user_arb_cash_entries',
    c.relrowsecurity and has_table_privilege('authenticated', c.oid, 'SELECT')
      and not has_table_privilege('authenticated', c.oid, 'INSERT')
  from pg_class c where c.oid = 'public.user_arb_cash_entries'::regclass
)
select object_kind, object_name, ready from checks
order by object_kind, object_name;
