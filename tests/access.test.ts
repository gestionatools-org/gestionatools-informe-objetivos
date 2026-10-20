import assert from "node:assert/strict"
import { test } from "node:test"
import { localRole, canUseDatabase } from "../src/lib/access-policy"

test("only manually assigned roles authorize active Hub users", () => {
  assert.equal(localRole(null, { status: "activo" }), null)
  assert.equal(localRole({ role: "admin" }, null), null)
  assert.equal(localRole({ role: "admin" }, { status: "inactivo" }), null)
  assert.equal(localRole({ role: "owner" }, { status: "activo" }), null)
  assert.equal(localRole({ role: "user" }, { status: "activo" }), "user")
  assert.equal(localRole({ role: "admin" }, { status: "activo" }), "admin")
})

test("fresh account and local role protect writes, including cross-tab account changes", () => {
  assert.equal(canUseDatabase({ sub: "a", role: "user" }, "a", false), true)
  assert.equal(canUseDatabase({ sub: "a", role: "user" }, "a", true), false)
  assert.equal(canUseDatabase({ sub: "a", role: "admin" }, "a", true), true)
  assert.equal(canUseDatabase({ sub: "b", role: "admin" }, "a", true), false)
  assert.equal(canUseDatabase({ sub: "b", role: "user" }, "a", false), false)
})
