"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { LocalDraft } from "@/components/local-draft"
import { adminDraftSchema } from "@/lib/drafts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createItemObjetivo,
  deleteItemObjetivo,
  fetchCommissions,
  fetchInstructionById,
  fetchInstructionsByCommission,
  fetchItemObjetivoById,
  fetchItemsExport,
  fetchMattersByInstruction,
  fetchSubmatterById,
  fetchSubmattersByMatter,
  fetchWorkLines,
  updateItemObjetivo,
} from "@/lib/supabase/queries"
import type {
  CommissionRecord,
  InstructionRecord,
  ItemObjetivoInput,
  ItemsExportRecord,
  MatterRecord,
  SubmatterRecord,
  WorkLineRecord,
} from "@/lib/supabase/types"

const formSchema = z.object({
  commission_id: z.string().min(1, "Comision requerida"),
  instruction_id: z.string().min(1, "Instruccion requerida"),
  matter_id: z.string().min(1, "Materia requerida"),
  submatter_id: z.string().min(1, "Submateria requerida"),
  work_line_id: z.string().min(1, "Linea requerida"),
  legacy_item_code: z.string().optional(),
  title: z.string().min(1, "Objetivo requerido"),
  status: z.string().optional(),
  year: z.literal(2026),
})

const defaultValues: z.infer<typeof formSchema> = {
  commission_id: "",
  instruction_id: "",
  matter_id: "",
  submatter_id: "",
  work_line_id: "",
  legacy_item_code: "",
  title: "",
  status: "",
  year: 2026,
}

const normalizeOptional = (value?: string) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

const toPayload = (values: z.infer<typeof formSchema>): ItemObjetivoInput => {
  return {
    instruction_id: values.instruction_id,
    submatter_id: values.submatter_id,
    work_line_id: values.work_line_id,
    title: values.title.trim(),
    status: normalizeOptional(values.status),
    year: values.year,
    legacy_item_code: normalizeOptional(values.legacy_item_code),
  }
}

export default function AdminDashboardPage() {
  const [items, setItems] = useState<ItemsExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [instructions, setInstructions] = useState<InstructionRecord[]>([])
  const [matters, setMatters] = useState<MatterRecord[]>([])
  const [submatters, setSubmatters] = useState<SubmatterRecord[]>([])
  const [workLines, setWorkLines] = useState<WorkLineRecord[]>([])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const isEditing = Boolean(editingId)
  const selectedCommissionId = useWatch({ control: form.control, name: "commission_id" })
  const selectedInstructionId = useWatch({ control: form.control, name: "instruction_id" })
  const selectedMatterId = useWatch({ control: form.control, name: "matter_id" })
  const selectedSubmatterId = useWatch({ control: form.control, name: "submatter_id" })
  const selectedWorkLineId = useWatch({ control: form.control, name: "work_line_id" })

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await fetchItemsExport()
      setItems(data)
    } catch {
      toast.error("No se pudieron cargar los items.")
    } finally {
      setLoading(false)
    }
  }

  const loadDimensions = async () => {
    try {
      const [commissionData, workLineData] = await Promise.all([
        fetchCommissions(),
        fetchWorkLines(),
      ])
      setCommissions(commissionData)
      setWorkLines(workLineData)
    } catch {
      toast.error("No se pudieron cargar las dimensiones.")
    }
  }

  useEffect(() => {
    let active = true

    const init = async () => {
      try {
        if (!active) return
        await loadItems()
        await loadDimensions()
      } catch {
        toast.error("No se pudo cargar el dashboard.")
      }
    }

    init()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedCommissionId) return

    let active = true
    fetchInstructionsByCommission(selectedCommissionId)
      .then((data) => {
        if (!active) return
        setInstructions(data)
      })
      .catch(() => {
        if (!active) return
        toast.error("No se pudieron cargar las instrucciones.")
      })

    return () => {
      active = false
    }
  }, [selectedCommissionId])

  useEffect(() => {
    if (!selectedInstructionId) return

    let active = true
    fetchMattersByInstruction(selectedInstructionId)
      .then((data) => {
        if (!active) return
        setMatters(data)
      })
      .catch(() => {
        if (!active) return
        toast.error("No se pudieron cargar las materias.")
      })

    return () => {
      active = false
    }
  }, [selectedInstructionId])

  useEffect(() => {
    if (!selectedMatterId) return

    let active = true
    fetchSubmattersByMatter(selectedMatterId)
      .then((data) => {
        if (!active) return
        setSubmatters(data)
      })
      .catch(() => {
        if (!active) return
        toast.error("No se pudieron cargar las submaterias.")
      })

    return () => {
      active = false
    }
  }, [selectedMatterId])

  const handleEdit = (item: ItemsExportRecord) => {
    if (form.formState.isDirty && !confirm("¿Descartar la edición actual y abrir otro ítem?")) return
    setEditingId(item.item_uuid)
    const hydrate = async () => {
      try {
        const record = await fetchItemObjetivoById(item.item_uuid)
        const instruction = await fetchInstructionById(record.instruction_id)
        const submatter = await fetchSubmatterById(record.submatter_id)
        if (instruction.commission_id) {
          const instructionOptions = await fetchInstructionsByCommission(
            instruction.commission_id,
          )
          setInstructions(instructionOptions)
        } else {
          setInstructions([])
        }

        const [matterOptions, submatterOptions] = await Promise.all([
          fetchMattersByInstruction(record.instruction_id),
          fetchSubmattersByMatter(submatter.matter_id),
        ])

        setMatters(matterOptions)
        setSubmatters(submatterOptions)

        form.reset({
          commission_id: instruction.commission_id ?? "",
          instruction_id: record.instruction_id,
          matter_id: submatter.matter_id,
          submatter_id: record.submatter_id,
          work_line_id: record.work_line_id,
          legacy_item_code: record.legacy_item_code ?? "",
          title: record.title,
          status: record.status ?? "",
          year: 2026,
        })
      } catch {
        toast.error("No se pudo cargar el item.")
      }
    }

    hydrate()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este item?")) return
    try {
      await deleteItemObjetivo(id)
      setItems((prev) => prev.filter((item) => item.item_uuid !== id))
      toast.success("Item eliminado.")
    } catch {
      toast.error("No se pudo eliminar el item.")
    }
  }

  const handleNew = (skipConfirmation = false) => {
    if (!skipConfirmation && form.formState.isDirty && !confirm("¿Descartar la edición actual?")) return
    setEditingId(null)
    form.reset(defaultValues)
    setInstructions([])
    setMatters([])
    setSubmatters([])
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const payload = toPayload(values)
      if (editingId) {
        await updateItemObjetivo(editingId, payload)
        toast.success("Item actualizado.")
      } else {
        await createItemObjetivo(payload)
        toast.success("Item creado.")
      }
      await loadItems()
      handleNew(true)
    } catch {
      toast.error("No se pudo guardar el item.")
    } finally {
      setSaving(false)
    }
  })

  const draftValues = useWatch({ control: form.control })
  const adminDraft = {
    editingId,
    values: { ...defaultValues, ...draftValues, year: 2026 as const,
      legacy_item_code: draftValues.legacy_item_code ?? "", status: draftValues.status ?? "" },
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      (a.instruction ?? "").localeCompare(b.instruction ?? ""),
    )
  }, [items])

  return (
    <section aria-label="Administración del catálogo" className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge className="mb-2">Admin</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona el catalogo de configuracion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => handleNew()}>
            Nuevo item
          </Button>
        </div>
      </header>

      <LocalDraft kind="catalog-item" schema={adminDraftSchema} value={adminDraft}
        dirty={form.formState.isDirty}
        onRestore={(draft) => {
          setEditingId(draft.editingId)
          form.reset(draft.values, { keepDefaultValues: true })
          toast.success("Edición recuperada. Revisa los datos antes de guardar.")
        }} />
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Editar item" : "Nuevo item"}</CardTitle>
          <CardDescription>
            Completa los campos y guarda el item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Comision</Label>
              <Select
                value={selectedCommissionId}
                onValueChange={(value) => {
                  setInstructions([])
                  setMatters([])
                  setSubmatters([])
                  form.setValue("commission_id", value, { shouldDirty: true })
                  form.setValue("instruction_id", "")
                  form.setValue("matter_id", "")
                  form.setValue("submatter_id", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {commissions.map((commission) => (
                    <SelectItem key={commission.id} value={commission.id}>
                      {commission.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instruccion</Label>
              <Select
                value={selectedInstructionId}
                onValueChange={(value) => {
                  setMatters([])
                  setSubmatters([])
                  form.setValue("instruction_id", value, { shouldDirty: true })
                  form.setValue("matter_id", "")
                  form.setValue("submatter_id", "")
                }}
                disabled={!selectedCommissionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {instructions.map((instruction) => (
                    <SelectItem key={instruction.id} value={instruction.id}>
                      {instruction.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Materia</Label>
              <Select
                value={selectedMatterId}
                onValueChange={(value) => {
                  form.setValue("matter_id", value, { shouldDirty: true })
                  form.setValue("submatter_id", "")
                }}
                disabled={!selectedInstructionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Submateria</Label>
              <Select
                value={selectedSubmatterId}
                onValueChange={(value) => form.setValue("submatter_id", value, { shouldDirty: true })}
                disabled={!selectedMatterId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {submatters.map((submatter) => (
                    <SelectItem key={submatter.id} value={submatter.id}>
                      {submatter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linea de trabajo</Label>
              <Select
                value={selectedWorkLineId}
                onValueChange={(value) => form.setValue("work_line_id", value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {workLines.map((workLine) => (
                    <SelectItem key={workLine.id} value={workLine.id}>
                      {workLine.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Codigo heredado</Label>
              <Input {...form.register("legacy_item_code")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Objetivo</Label>
              <Input {...form.register("title")} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input {...form.register("status")} />
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Input
                type="number"
                readOnly
                {...form.register("year", { valueAsNumber: true })}
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
              </Button>
              {isEditing && (
                <Button type="button" variant="ghost" onClick={() => handleNew()}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items configurados</CardTitle>
          <CardDescription>
            {loading ? "Cargando items..." : `${sortedItems.length} items`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Cargando items...
            </div>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
              <div className="grid min-w-[48rem] grid-cols-[1.4fr_1fr_1.6fr_0.7fr_auto] gap-3 border-b border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>Instruccion</span>
                <span>Linea</span>
                <span>Objetivo</span>
                <span>ID</span>
                <span>Accion</span>
              </div>
              {sortedItems.map((item) => (
                <div
                  key={item.item_uuid}
                  className="grid min-w-[48rem] grid-cols-[1.4fr_1fr_1.6fr_0.7fr_auto] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <div className="text-xs text-foreground">
                    {item.instruction ?? "Sin instruccion"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.work_line ?? "Sin linea"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.title ?? "Sin objetivo"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.item_code ?? "Sin ID"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.item_uuid)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
              {!loading && sortedItems.length === 0 && (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No hay items cargados.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
