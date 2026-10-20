"use server"

import { authorizedDatabase } from "@/lib/access"
import { itemInputSchema } from "@/lib/item-validation"
import type {
  CommissionRecord,
  InstructionOption,
  InstructionRecord,
  ItemObjetivoInput,
  ItemObjetivoRecord,
  ItemsExportRecord,
  MatterRecord,
  ObjectiveItem,
  SubmatterRecord,
  WorkLineOption,
  WorkLineRecord,
} from "@/lib/supabase/types"

const normalizeObjectiveItem = (item: ItemsExportRecord): ObjectiveItem | null => {
  if (!item.instruction || !item.title) {
    return null
  }

  return {
    id: item.item_uuid,
    legacy_id: item.item_legacy_id ?? null,
    item_id: item.item_code ?? null,
    commission: item.commission ?? null,
    instruction: item.instruction,
    matter: item.matter ?? null,
    submatter: item.submatter ?? null,
    work_line: item.work_line ?? null,
    work_line_id: item.work_line_id ?? null,
    work_line_sort_order: item.work_line_sort_order ?? null,
    item_objective: item.title ?? null,
    item_objective_2: null,
    status: item.status ?? null,
    year: item.year ?? 2026,
  }
}

export const fetchInstructions = async (owner: string): Promise<InstructionOption[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_instructions")
    .select("id,legacy_id,name,commission:informeobjetivos_commissions(name)")
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  const rows =
    (data as Array<{
      id: string
      legacy_id: string
      name: string
      commission?: { name?: string } | null
    }>) ?? []

  return rows.map((item) => ({
    id: item.id,
    label: item.name,
    commission: item.commission?.name ?? null,
  }))
}

export const fetchWorkLinesForInstruction = async (owner: string, instructionId: string): Promise<WorkLineOption[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_items_objetivo")
    .select("work_line_id, work_lines:informeobjetivos_work_lines(id,legacy_id,display_name,code,sort_order)")
    .eq("instruction_id", instructionId)
    .or("status.is.null,status.neq.ELIMINAR")

  if (error) {
    throw error
  }

  const map = new Map<string, WorkLineOption>()
  ;(data ?? []).forEach((row) => {
    const workLine = (row as unknown as { work_lines?: WorkLineRecord }).work_lines
    if (!workLine) return
    if (!map.has(workLine.id)) {
      map.set(workLine.id, {
        id: workLine.id,
        label: workLine.display_name,
        code: workLine.code,
        sort_order: workLine.sort_order ?? null,
      })
    }
  })

  return Array.from(map.values()).sort((a, b) => {
    const orderA = a.sort_order ?? 999
    const orderB = b.sort_order ?? 999
    if (orderA !== orderB) return orderA - orderB
    return a.label.localeCompare(b.label)
  })
}

export const fetchItemsForInstructionAndWorkLine = async (owner: string, instructionId: string,
  workLineId: string): Promise<ObjectiveItem[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_v_items_export")
    .select("*")
    .eq("instruction_id", instructionId)
    .eq("work_line_id", workLineId)
    .or("status.is.null,status.neq.ELIMINAR")
    .order("title", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? [])
    .map((item) => normalizeObjectiveItem(item as ItemsExportRecord))
    .filter((item): item is ObjectiveItem => Boolean(item))
}

export const fetchItemsExport = async (owner: string): Promise<ItemsExportRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_v_items_export")
    .select("*")
    .order("instruction", { ascending: true })
    .order("work_line_sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ItemsExportRecord[]
}

export const fetchAllObjectiveItems = async (owner: string): Promise<ObjectiveItem[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_v_items_export")
    .select("*")
    .or("status.is.null,status.neq.ELIMINAR")
    .order("instruction", { ascending: true })
    .order("work_line_sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? [])
    .map((item) => normalizeObjectiveItem(item as ItemsExportRecord))
    .filter((item): item is ObjectiveItem => Boolean(item))
}

export const fetchCommissions = async (owner: string): Promise<CommissionRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_commissions")
    .select("id,legacy_id,name")
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as CommissionRecord[]
}

export const fetchInstructionsByCommission = async (owner: string, commissionId: string): Promise<InstructionRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_instructions")
    .select("id,legacy_id,commission_id,name,name_i18n,legacy_instruction_id")
    .eq("commission_id", commissionId)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as InstructionRecord[]
}

export const fetchInstructionById = async (owner: string, id: string) => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_instructions")
    .select("id,legacy_id,commission_id,name,name_i18n,legacy_instruction_id")
    .eq("id", id)
    .single()

  if (error) {
    throw error
  }

  return data as InstructionRecord
}

export const fetchMattersByInstruction = async (owner: string, instructionId: string): Promise<MatterRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_matters")
    .select("id,legacy_id,instruction_id,name")
    .eq("instruction_id", instructionId)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as MatterRecord[]
}

export const fetchSubmattersByMatter = async (owner: string, matterId: string): Promise<SubmatterRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_submatters")
    .select("id,legacy_id,matter_id,name")
    .eq("matter_id", matterId)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as SubmatterRecord[]
}

export const fetchSubmatterById = async (owner: string, id: string) => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_submatters")
    .select("id,legacy_id,matter_id,name")
    .eq("id", id)
    .single()

  if (error) {
    throw error
  }

  return data as SubmatterRecord
}

export const fetchWorkLines = async (owner: string): Promise<WorkLineRecord[]> => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_work_lines")
    .select("id,legacy_id,code,display_name,display_name_i18n,sort_order")
    .order("sort_order", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as WorkLineRecord[]
}

export const createItemObjetivo = async (owner: string, payload: ItemObjetivoInput) => {
  const supabase = await authorizedDatabase(true, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_items_objetivo")
    .insert(itemInputSchema.parse(payload))
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as ItemObjetivoRecord
}

export const updateItemObjetivo = async (owner: string, id: string,
  payload: ItemObjetivoInput) => {
  const supabase = await authorizedDatabase(true, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_items_objetivo")
    .update(itemInputSchema.parse(payload))
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as ItemObjetivoRecord
}

export const deleteItemObjetivo = async (owner: string, id: string) => {
  const supabase = await authorizedDatabase(true, owner)
  const { error } = await supabase
    .from("informeobjetivos_items_objetivo")
    .delete()
    .eq("id", id)

  if (error) {
    throw error
  }
}

export const fetchItemObjetivoById = async (owner: string, id: string) => {
  const supabase = await authorizedDatabase(false, owner)
  const { data, error } = await supabase
    .from("informeobjetivos_items_objetivo")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    throw error
  }

  return data as ItemObjetivoRecord
}
