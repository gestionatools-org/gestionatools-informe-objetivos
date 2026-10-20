-- Read-only. Compare counts and OIDs to the saved diagnosis.
select n.nspname, c.relname, c.oid, c.relrowsecurity, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'iobjetivos') and c.relname like 'informeobjetivos_%'
order by c.relname;

select 'commissions' as object, count(*) from iobjetivos.informeobjetivos_commissions
union all select 'instructions', count(*) from iobjetivos.informeobjetivos_instructions
union all select 'matters', count(*) from iobjetivos.informeobjetivos_matters
union all select 'submatters', count(*) from iobjetivos.informeobjetivos_submatters
union all select 'work_lines', count(*) from iobjetivos.informeobjetivos_work_lines
union all select 'items_objetivo', count(*) from iobjetivos.informeobjetivos_items_objetivo
union all select 'v_items_export', count(*) from iobjetivos.informeobjetivos_v_items_export;

-- All direct-access privilege checks must be false.
select role_name, c.relname,
  has_schema_privilege(role_name, 'iobjetivos', 'usage') as schema_usage,
  has_table_privilege(role_name, c.oid, 'select') as can_select,
  has_table_privilege(role_name, c.oid, 'insert,update,delete') as can_write
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) roles(role_name)
where n.nspname = 'iobjetivos' and (c.relname like 'informeobjetivos_%' or c.relname = 'app_users')
  and c.relkind in ('r', 'v');

select u.hub_user_id, u.role, h.email, h.status
from iobjetivos.app_users u join public.usuarios_gtools h on h.id = u.hub_user_id;
