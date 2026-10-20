import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const tables = ["commissions", "instructions", "matters", "submatters", "work_lines", "items_objetivo", "v_items_export"].map(name => `informeobjetivos_${name}`)

async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.usuarios_gtools (id uuid primary key default gen_random_uuid(), email text, status text default 'activo');
    create table public.unrelated (id int primary key); insert into public.unrelated values (7);`)
  // gen_random_uuid() is built into PostgreSQL. PGlite does not ship the pgcrypto extension.
  await db.exec((await read("supabase/migrations/20260729000000_create_catalog_schema.sql")).replace('create extension if not exists "pgcrypto";', ""))
  await db.exec(await read("supabase/migrations/20260729000001_seed_catalog.sql"))
  return db
}

test("catalog move preserves every row, OID, view and FK; direct access is denied; rollback preserves rows", async () => {
  const db = await fixture()
  try {
    const before = new Map<string, unknown>()
    const oids = new Map<string, unknown>()
    for (const table of tables) {
      before.set(table, (await db.query(`select * from public.${table} order by 1`)).rows)
      oids.set(table, (await db.query(`select 'public.${table}'::regclass::oid as id`)).rows)
    }
    await db.exec(await read("supabase/migrations/20261020000000_move_catalog_to_iobjetivos.sql"))
    for (const table of tables) {
      assert.deepEqual((await db.query(`select * from iobjetivos.${table} order by 1`)).rows, before.get(table))
      assert.deepEqual((await db.query(`select 'iobjetivos.${table}'::regclass::oid as id`)).rows, oids.get(table))
      for (const role of ["anon", "authenticated"]) {
        assert.deepEqual((await db.query(`select has_table_privilege('${role}', 'iobjetivos.${table}', 'select') as allowed`)).rows, [{ allowed: false }])
      }
    }
    await db.exec(`insert into public.usuarios_gtools (id) values ('00000000-0000-4000-8000-000000000001');
      insert into iobjetivos.app_users (hub_user_id, role) values ('00000000-0000-4000-8000-000000000001', 'user');`)
    await assert.rejects(db.exec(`insert into iobjetivos.app_users (hub_user_id, role) values (gen_random_uuid(), 'admin')`))
    await assert.rejects(db.exec(`update iobjetivos.app_users set role = 'owner'`))
    await assert.rejects(db.exec(`update iobjetivos.informeobjetivos_items_objetivo set instruction_id = gen_random_uuid()`))
    assert.deepEqual((await db.query(`select * from public.unrelated`)).rows, [{ id: 7 }])
    await db.exec(await read("supabase/manual/03_validate.sql"))
    await db.exec(await read("supabase/manual/04_rollback.sql"))
    for (const table of tables) assert.deepEqual((await db.query(`select * from public.${table} order by 1`)).rows, before.get(table))
  } finally { await db.close() }
})

test("external dependencies abort before any table is moved", async () => {
  const db = await fixture()
  try {
    await db.exec(`create view public.unrelated_view as select id from public.informeobjetivos_commissions`)
    await assert.rejects(db.exec(await read("supabase/migrations/20261020000000_move_catalog_to_iobjetivos.sql")), /External FK\/view dependency/)
    await db.exec("rollback")
    assert.deepEqual((await db.query(`select to_regclass('iobjetivos.informeobjetivos_items_objetivo') as object`)).rows, [{ object: null }])
  } finally { await db.close() }
})
