-- Read-only. Run before applying the move migration and save these results.
select n.nspname as schema, c.relname, c.oid, c.relkind, c.relrowsecurity,
       c.relacl, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname in ('public', 'iobjetivos') and c.relname like 'informeobjetivos_%')
   or (n.nspname = 'public' and c.relname = 'usuarios_gtools')
order by n.nspname, c.relname;

select * from pg_policies
where schemaname in ('public', 'iobjetivos') and tablename like 'informeobjetivos_%';

-- Save a schema/data backup separately before the cutover (see docs/schema-rollout.md).
select 'commissions' as object, count(*) from public.informeobjetivos_commissions
union all select 'instructions', count(*) from public.informeobjetivos_instructions
union all select 'matters', count(*) from public.informeobjetivos_matters
union all select 'submatters', count(*) from public.informeobjetivos_submatters
union all select 'work_lines', count(*) from public.informeobjetivos_work_lines
union all select 'items_objetivo', count(*) from public.informeobjetivos_items_objetivo
union all select 'v_items_export', count(*) from public.informeobjetivos_v_items_export;
