import assert from "node:assert/strict"
import { test } from "node:test"
import { z } from "zod"
import { DRAFT_TTL_MS, draftKey, loadDrafts, reportDraftSchema } from "../src/lib/drafts"
import { itemInputSchema } from "../src/lib/item-validation"

class StorageMock {
  values = new Map<string, string>()
  get length() { return this.values.size }
  key(i: number) { return [...this.values.keys()][i] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  removeItem(key: string) { this.values.delete(key) }
}

test("drafts are isolated by owner and tab; malformed and expired drafts are removed", () => {
  const storage = new StorageMock()
  const now = Date.now()
  const put = (owner: string, tab: string, modifiedAt: number, value: unknown = "draft") => storage.values.set(draftKey(owner, tab, "report"), JSON.stringify({ version: 1, owner, tab, kind: "report", modifiedAt, value }))
  put("a", "tab-1", now)
  put("a", "tab-2", now - 1000)
  put("b", "tab-1", now)
  put("a", "expired", now - DRAFT_TTL_MS)
  put("a", "future", now + 1)
  put("a", "invalid", now, { wrong: true })
  const drafts = loadDrafts(storage, "a", "report", z.string(), now)
  assert.equal(drafts.length, 2)
  assert.notEqual(drafts[0].key, drafts[1].key)
  assert.equal(storage.length, 3)
  assert.equal(loadDrafts(storage, "b", "report", z.string(), now).length, 1)
})

test("manual JSON drafts remain compatible and incomplete metadata can autosave", () => {
  const draft = { version: 1, metadata: { entity: "", manager: "" }, items: [] }
  assert.deepEqual(reportDraftSchema.parse(draft), draft)
  assert.equal(reportDraftSchema.safeParse({ ...draft, items: [{ item: {} }] }).success, false)
})

test("server item validation enforces UUIDs, fixed year and allowed columns", () => {
  const id = "00000000-0000-4000-8000-000000000001"
  const valid = { instruction_id: id, submatter_id: id, work_line_id: id, title: "  Goal  ", status: null, year: 2026, legacy_item_code: null }
  assert.equal(itemInputSchema.parse(valid).title, "Goal")
  for (const change of [{ year: 2027 }, { title: " " }, { instruction_id: "bad-id" }, { role: "admin" }]) {
    assert.equal(itemInputSchema.safeParse({ ...valid, ...change }).success, false)
  }
})
