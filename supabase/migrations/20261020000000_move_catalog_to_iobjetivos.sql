-- Apply manually during the coordinated application cutover. Do not repeat the seed.
begin;

create schema if not exists iobjetivos;

create temporary table iobjetivos_move_check (
  name text primary key, object_oid oid not null, row_count bigint not null
) on commit drop;

do $$
declare
  object_name text;
  object_id oid;
  total bigint;
  catalog_names text[] := array[
    'informeobjetivos_commissions', 'informeobjetivos_instructions',
    'informeobjetivos_matters', 'informeobjetivos_submatters',
    'informeobjetivos_work_lines', 'informeobjetivos_items_objetivo',
    'informeobjetivos_v_items_export'
  ];
begin
  if to_regclass('public.usuarios_gtools') is null then
    raise exception 'Missing public.usuarios_gtools in this database';
  end if;
  if to_regclass('iobjetivos.app_users') is not null then
    raise exception 'iobjetivos.app_users already exists; inspect migration state';
  end if;
  foreach object_name in array catalog_names loop
    object_id := to_regclass(format('public.%I', object_name));
    if object_id is null or to_regclass(format('iobjetivos.%I', object_name)) is not null then
      raise exception 'Missing source or conflicting destination: %', object_name;
    end if;
    if exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f' and c.confrelid = object_id
        and not (n.nspname = 'public' and t.relname = any(catalog_names))
    ) or exists (
      select 1 from pg_depend d
      join pg_rewrite r on r.oid = d.objid
      join pg_class v on v.oid = r.ev_class
      join pg_namespace n on n.oid = v.relnamespace
      where d.refobjid = object_id and d.classid = 'pg_rewrite'::regclass
        and not (n.nspname = 'public' and v.relname = any(catalog_names))
    ) then
      raise exception 'External FK/view dependency on %; review before moving', object_name;
    end if;
    -- Lock before counting, keeping concurrent writes out until commit.
    if object_name <> 'informeobjetivos_v_items_export' then
      execute format('lock table public.%I in access exclusive mode', object_name);
    end if;
    execute format('select count(*) from public.%I', object_name) into total;
    insert into iobjetivos_move_check values (object_name, object_id, total);
  end loop;
end $$;

alter table public.informeobjetivos_commissions set schema iobjetivos;
alter table public.informeobjetivos_instructions set schema iobjetivos;
alter table public.informeobjetivos_matters set schema iobjetivos;
alter table public.informeobjetivos_submatters set schema iobjetivos;
alter table public.informeobjetivos_work_lines set schema iobjetivos;
alter table public.informeobjetivos_items_objetivo set schema iobjetivos;
alter view public.informeobjetivos_v_items_export set schema iobjetivos;
alter view iobjetivos.informeobjetivos_v_items_export set (security_invoker = true);

create table iobjetivos.app_users (
  hub_user_id uuid primary key references public.usuarios_gtools(id) on delete cascade,
  role text not null check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
alter table iobjetivos.app_users enable row level security;

do $$
declare
  record_row record;
  total bigint;
begin
  for record_row in select * from iobjetivos_move_check loop
    if to_regclass(format('iobjetivos.%I', record_row.name))::oid <> record_row.object_oid then
      raise exception 'Object identity changed: %', record_row.name;
    end if;
    execute format('select count(*) from iobjetivos.%I', record_row.name) into total;
    if total <> record_row.row_count then
      raise exception 'Row count changed: %', record_row.name;
    end if;
    execute format('revoke all privileges on iobjetivos.%I from public, anon, authenticated', record_row.name);
    execute format('grant select on iobjetivos.%I to service_role', record_row.name);
    if record_row.name <> 'informeobjetivos_v_items_export' then
      execute format('alter table iobjetivos.%I enable row level security', record_row.name);
    end if;
  end loop;
end $$;

revoke all on schema iobjetivos from public, anon, authenticated;
grant usage on schema iobjetivos to service_role;
revoke all on iobjetivos.app_users from public, anon, authenticated;
grant select on iobjetivos.app_users to service_role;
grant insert, update, delete on iobjetivos.informeobjetivos_items_objetivo to service_role;

-- Authorization checks are enforced by the server; the Hub cookie is not a Supabase JWT.
notify pgrst, 'reload schema';
commit;
