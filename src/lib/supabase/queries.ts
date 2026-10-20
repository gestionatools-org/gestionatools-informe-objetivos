"use client"

import * as actions from "@/lib/supabase/actions"
import type { InstructionOption, ItemObjetivoInput, ObjectiveItem, WorkLineOption, ItemsExportRecord, CommissionRecord, InstructionRecord, MatterRecord, SubmatterRecord, WorkLineRecord } from "@/lib/supabase/types"

let queryOwner: string | undefined
export function setQueryOwner(owner: string | undefined) { queryOwner = owner }
function owner() {
  if (!queryOwner) throw new Error("Session is not ready")
  return queryOwner
}

export const fetchInstructions = async (): Promise<InstructionOption[]> => actions.fetchInstructions(owner())
export const fetchWorkLinesForInstruction = async (instructionId: string): Promise<WorkLineOption[]> => actions.fetchWorkLinesForInstruction(owner(), instructionId)
export const fetchItemsForInstructionAndWorkLine = async (instructionId: string,
  workLineId: string): Promise<ObjectiveItem[]> => actions.fetchItemsForInstructionAndWorkLine(owner(), instructionId, workLineId)
export const fetchItemsExport = async (): Promise<ItemsExportRecord[]> => actions.fetchItemsExport(owner())
export const fetchAllObjectiveItems = async (): Promise<ObjectiveItem[]> => actions.fetchAllObjectiveItems(owner())
export const fetchCommissions = async (): Promise<CommissionRecord[]> => actions.fetchCommissions(owner())
export const fetchInstructionsByCommission = async (commissionId: string): Promise<InstructionRecord[]> => actions.fetchInstructionsByCommission(owner(), commissionId)
export const fetchInstructionById = async (id: string) => actions.fetchInstructionById(owner(), id)
export const fetchMattersByInstruction = async (instructionId: string): Promise<MatterRecord[]> => actions.fetchMattersByInstruction(owner(), instructionId)
export const fetchSubmattersByMatter = async (matterId: string): Promise<SubmatterRecord[]> => actions.fetchSubmattersByMatter(owner(), matterId)
export const fetchSubmatterById = async (id: string) => actions.fetchSubmatterById(owner(), id)
export const fetchWorkLines = async (): Promise<WorkLineRecord[]> => actions.fetchWorkLines(owner())
export const createItemObjetivo = async (payload: ItemObjetivoInput) => actions.createItemObjetivo(owner(), payload)
export const updateItemObjetivo = async (id: string,
  payload: ItemObjetivoInput) => actions.updateItemObjetivo(owner(), id, payload)
export const deleteItemObjetivo = async (id: string) => actions.deleteItemObjetivo(owner(), id)
export const fetchItemObjetivoById = async (id: string) => actions.fetchItemObjetivoById(owner(), id)
