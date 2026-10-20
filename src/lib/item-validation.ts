import { z } from "zod"

export const itemInputSchema = z.object({
  instruction_id: z.uuid(),
  submatter_id: z.uuid(),
  work_line_id: z.uuid(),
  title: z.string().trim().min(1).max(10000),
  status: z.string().trim().max(100).nullable(),
  year: z.literal(2026),
  legacy_item_code: z.string().trim().max(200).nullable(),
}).strict()
