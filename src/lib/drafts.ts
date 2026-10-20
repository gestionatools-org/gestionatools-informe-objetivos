import { z } from "zod"

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
export const draftPrefix = (owner: string) => `iobjetivos:draft:1:${encodeURIComponent(owner)}:`
export const draftKey = (owner: string, tab: string, kind: string) => `${draftPrefix(owner)}${tab}:${kind}`
const envelope = z.object({ version: z.literal(1), owner: z.string(), tab: z.string(), kind: z.string(), modifiedAt: z.number().finite(), value: z.unknown() })

export function loadDrafts<T>(storage: Pick<Storage, "length" | "key" | "getItem" | "removeItem">, owner: string, kind: string, schema: z.ZodType<T>, now = Date.now()) {
  const drafts: { key: string; modifiedAt: number; value: T }[] = []
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i))
  for (const key of keys) {
    if (!key?.startsWith(draftPrefix(owner))) continue
    try {
      const record = envelope.parse(JSON.parse(storage.getItem(key) || "null"))
      if (record.owner !== owner || record.modifiedAt > now || now - record.modifiedAt >= DRAFT_TTL_MS) {
        storage.removeItem(key)
        continue
      }
      if (record.kind !== kind) continue
      drafts.push({ key, modifiedAt: record.modifiedAt, value: schema.parse(record.value) })
    } catch { storage.removeItem(key) }
  }
  return drafts.sort((a, b) => b.modifiedAt - a.modifiedAt)
}

export const objectiveSnapshotSchema = z.object({
  id: z.string().min(1), legacy_id: z.string().nullable(), item_id: z.string().nullable(),
  commission: z.string().nullable(), instruction: z.string(), matter: z.string().nullable(),
  submatter: z.string().nullable(), work_line: z.string().nullable(), work_line_id: z.string().nullable(),
  work_line_sort_order: z.number().nullable(), item_objective: z.string().nullable(),
  item_objective_2: z.string().nullable(), status: z.string().nullable(), year: z.number(),
})
export const reportDraftSchema = z.object({
  version: z.literal(1), metadata: z.object({ entity: z.string(), manager: z.string() }),
  items: z.array(z.object({ item: objectiveSnapshotSchema, deadline: z.string(), observations: z.string() })),
})
export const adminDraftSchema = z.object({
  editingId: z.uuid().nullable(),
  values: z.object({
    commission_id: z.string(), instruction_id: z.string(), matter_id: z.string(),
    submatter_id: z.string(), work_line_id: z.string(), title: z.string(),
    legacy_item_code: z.string(), status: z.string(), year: z.literal(2026),
  }),
})
