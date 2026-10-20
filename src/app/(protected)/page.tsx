"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Download } from "lucide-react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAllObjectiveItems } from "@/hooks/use-all-objective-items"
import { LocalDraft } from "@/components/local-draft"
import { reportDraftSchema } from "@/lib/drafts"
import type { ObjectiveItem } from "@/lib/supabase/types"

const formSchema = z.object({
  entity: z.string().min(2, "Entidad requerida"),
  manager: z.string().min(2, "Gestor requerido"),
})

const deadlineOptions = [
  "Primer trimestre",
  "Segundo trimestre",
  "Tercer trimestre",
  "Cuarto trimestre",
  "Año completo",
] as const

type DraftItem = {
  item: ObjectiveItem
  deadline: string
  observations: string
}

type DraftPayload = {
  version: 1
  metadata: {
    entity: string
    manager: string
  }
  items: DraftItem[]
}

const DRAFT_VERSION = 1

const pdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 140,
    height: 37,
  },
  title: {
    fontSize: 16,
    marginBottom: 6,
    fontWeight: 700,
  },
  meta: {
    fontSize: 11,
    marginBottom: 2,
  },
  section: {
    marginTop: 12,
  },
  instruction: {
    fontSize: 12,
    fontWeight: 600,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  rowItem: {
    width: "45%",
    paddingRight: 8,
  },
  rowDeadline: {
    width: "25%",
    paddingRight: 8,
  },
  rowObservations: {
    width: "30%",
  },
  rowTitle: {
    fontSize: 11,
    fontWeight: 600,
  },
  rowDetails: {
    marginTop: 2,
  },
  rowLine: {
    fontSize: 10,
    color: "#374151",
  },
  rowMeta: {
    fontSize: 10,
    color: "#111827",
  },
})

const compareObjectiveItems = (a: ObjectiveItem, b: ObjectiveItem) => {
  const instructionCompare = (a.instruction ?? "").localeCompare(
    b.instruction ?? "",
  )
  if (instructionCompare !== 0) return instructionCompare
  const workLineOrderA = a.work_line_sort_order ?? 999
  const workLineOrderB = b.work_line_sort_order ?? 999
  if (workLineOrderA !== workLineOrderB) {
    return workLineOrderA - workLineOrderB
  }
  const workLineCompare = (a.work_line ?? "").localeCompare(b.work_line ?? "")
  if (workLineCompare !== 0) return workLineCompare
  return (a.item_objective ?? "").localeCompare(b.item_objective ?? "")
}

type MultiSelectFilterProps = {
  title: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  disabled?: boolean
}

const MultiSelectFilter = ({
  title,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
}: MultiSelectFilterProps) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedCount = value.length
  const label =
    selectedCount === 0
      ? placeholder
      : `${selectedCount} seleccionadas`

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative z-20 min-w-0 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex w-full min-w-[12rem] items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span>{label}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          {open && !disabled && (
            <div className="absolute left-0 z-50 mt-2 w-60 sm:w-72 rounded-md border border-border bg-background p-2 shadow-lg">
            {options.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No hay opciones disponibles.
              </div>
            ) : (
              <div className="max-h-64 overflow-auto">
                {options.map((option) => {
                  const checked = value.includes(option)
                  return (
                    <label
                      key={option}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          onChange(
                            nextChecked
                              ? value.includes(option)
                                ? value
                                : [...value, option]
                              : value.filter((item) => item !== option),
                          )
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  )
                })}
              </div>
            )}
            </div>
          )}
        </div>
        <Badge variant="outline">
          {selectedCount === 0 ? "Sin filtros" : `${selectedCount} activas`}
        </Badge>
      </div>
    </div>
  )
}

export default function Home() {
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { item: ObjectiveItem; deadline: string; observations: string }>
  >({})
  const [selectedInstructionFilters, setSelectedInstructionFilters] = useState<string[]>(
    [],
  )
  const [availableInstructionFilters, setAvailableInstructionFilters] = useState<
    string[]
  >([])
  const [selectedWorkLineFilters, setSelectedWorkLineFilters] = useState<string[]>(
    [],
  )
  const [availableWorkLineFilters, setAvailableWorkLineFilters] = useState<string[]>(
    [],
  )
  const [availableChecked, setAvailableChecked] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedChecked, setSelectedChecked] = useState<Set<string>>(
    () => new Set(),
  )
  const draftInputRef = useRef<HTMLInputElement | null>(null)

  const {
    data: allObjectiveItems,
    error: itemsError,
    loading: itemsLoading,
  } = useAllObjectiveItems()

  const selectedRows = useMemo(() => {
    return Object.values(selectedItems).sort((a, b) =>
      compareObjectiveItems(a.item, b.item),
    )
  }, [selectedItems])
  const selectedIds = useMemo(() => Object.keys(selectedItems), [selectedItems])
  const availableItems = useMemo(() => {
    return allObjectiveItems.filter((item) => !selectedIds.includes(item.id))
  }, [allObjectiveItems, selectedIds])
  const instructionOptions = useMemo(() => {
    const set = new Set<string>()
    allObjectiveItems.forEach((item) => {
      if (item.instruction) {
        set.add(item.instruction)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [allObjectiveItems])
  const availableInstructionFilteredItems = useMemo(() => {
    if (availableInstructionFilters.length === 0) return availableItems
    const active = new Set(availableInstructionFilters)
    return availableItems.filter((item) =>
      item.instruction ? active.has(item.instruction) : false,
    )
  }, [availableInstructionFilters, availableItems])
  const availableWorkLineOptions = useMemo(() => {
    if (availableInstructionFilters.length === 0) return []
    const set = new Set<string>()
    availableInstructionFilteredItems.forEach((item) => {
      if (item.work_line) {
        set.add(item.work_line)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [availableInstructionFilters.length, availableInstructionFilteredItems])
  const effectiveAvailableWorkLineFilters = useMemo(() => {
    if (availableInstructionFilters.length === 0) return []
    const activeOptions = new Set(availableWorkLineOptions)
    return availableWorkLineFilters.filter((line) => activeOptions.has(line))
  }, [
    availableInstructionFilters.length,
    availableWorkLineFilters,
    availableWorkLineOptions,
  ])
  const filteredAvailableItems = useMemo(() => {
    if (effectiveAvailableWorkLineFilters.length === 0) {
      return availableInstructionFilteredItems
    }
    const active = new Set(effectiveAvailableWorkLineFilters)
    return availableInstructionFilteredItems.filter((item) =>
      item.work_line ? active.has(item.work_line) : false,
    )
  }, [availableInstructionFilteredItems, effectiveAvailableWorkLineFilters])
  const groupedAvailableItems = useMemo(() => {
    const map = new Map<string, ObjectiveItem[]>()
    filteredAvailableItems.forEach((item) => {
      const key = item.instruction || "Sin instruccion"
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)?.push(item)
    })
    const entries = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    entries.forEach(([, items]) => items.sort(compareObjectiveItems))
    return entries
  }, [filteredAvailableItems])
  const selectedInstructionFilteredRows = useMemo(() => {
    if (selectedInstructionFilters.length === 0) return selectedRows
    const active = new Set(selectedInstructionFilters)
    return selectedRows.filter((row) => active.has(row.item.instruction))
  }, [selectedInstructionFilters, selectedRows])
  const selectedWorkLineOptions = useMemo(() => {
    if (selectedInstructionFilters.length === 0) return []
    const set = new Set<string>()
    selectedInstructionFilteredRows.forEach((row) => {
      if (row.item.work_line) {
        set.add(row.item.work_line)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [selectedInstructionFilters.length, selectedInstructionFilteredRows])
  const effectiveSelectedWorkLineFilters = useMemo(() => {
    if (selectedInstructionFilters.length === 0) return []
    const activeOptions = new Set(selectedWorkLineOptions)
    return selectedWorkLineFilters.filter((line) => activeOptions.has(line))
  }, [
    selectedInstructionFilters.length,
    selectedWorkLineFilters,
    selectedWorkLineOptions,
  ])
  const filteredSelectedRows = useMemo(() => {
    if (effectiveSelectedWorkLineFilters.length === 0) {
      return selectedInstructionFilteredRows
    }
    const active = new Set(effectiveSelectedWorkLineFilters)
    return selectedInstructionFilteredRows.filter((row) =>
      row.item.work_line ? active.has(row.item.work_line) : false,
    )
  }, [effectiveSelectedWorkLineFilters, selectedInstructionFilteredRows])
  const groupedSelectedRows = useMemo(() => {
    const map = new Map<string, typeof selectedRows>()
    filteredSelectedRows.forEach((row) => {
      const key = row.item.instruction || "Sin instruccion"
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)?.push(row)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredSelectedRows])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entity: "",
      manager: "",
    },
  })

  const metadata = useWatch({ control: form.control })
  const reportDraft: DraftPayload = {
    version: 1,
    metadata: { entity: metadata.entity ?? "", manager: metadata.manager ?? "" },
    items: selectedRows,
  }

  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSelectedChecked((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
  const handleAddItem = (item: ObjectiveItem) => {
    setSelectedItems((prev) => {
      if (prev[item.id]) return prev
      return { ...prev, [item.id]: { item, deadline: "", observations: "" } }
    })
    setAvailableChecked((prev) => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
  }

  const handleRestoreAll = () => {
    setSelectedItems({})
    setAvailableChecked(new Set())
    setSelectedChecked(new Set())
  }

  const handleClearSelection = () => {
    setSelectedItems({})
    setAvailableChecked(new Set())
    setSelectedChecked(new Set())
  }

  const handleAddSelected = () => {
    if (availableChecked.size === 0) return
    const availableMap = new Map(
      availableItems.map((item) => [item.id, item]),
    )
    setSelectedItems((prev) => {
      const next = { ...prev }
      availableChecked.forEach((id) => {
        const item = availableMap.get(id)
        if (!item || next[id]) return
        next[id] = { item, deadline: "", observations: "" }
      })
      return next
    })
    setAvailableChecked(new Set())
  }

  const handleAddAllAvailable = () => {
    if (availableItems.length === 0) return
    setSelectedItems((prev) => {
      const next = { ...prev }
      availableItems.forEach((item) => {
        if (!next[item.id]) {
          next[item.id] = { item, deadline: "", observations: "" }
        }
      })
      return next
    })
    setAvailableChecked(new Set())
  }

  const handleRemoveSelected = () => {
    if (selectedChecked.size === 0) return
    setSelectedItems((prev) => {
      const next = { ...prev }
      selectedChecked.forEach((id) => {
        delete next[id]
      })
      return next
    })
    setSelectedChecked(new Set())
  }

  const handleExportDraft = () => {
    const values = form.getValues()
    const entity = values.entity.trim()
    if (!entity) {
      toast.error("Completa la entidad antes de exportar el borrador.")
      return
    }
    const payload: DraftPayload = {
      version: DRAFT_VERSION,
      metadata: {
        entity,
        manager: values.manager,
      },
      items: selectedRows,
    }

    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    const safeEntity = entity
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
    const entityPart = safeEntity || "entidad"
    link.href = url
    link.download = `borrador-informe-${stamp}-${entityPart}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success("Borrador exportado.")
  }

  const handleImportDraft = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = reportDraftSchema.parse(JSON.parse(String(reader.result)))
        if (parsed.version !== DRAFT_VERSION || !Array.isArray(parsed.items)) {
          toast.error("El borrador no tiene un formato valido.")
          return
        }

        form.setValue("entity", parsed.metadata?.entity ?? "")
        form.setValue("manager", parsed.metadata?.manager ?? "")
        setSelectedItems(() => {
          const next: Record<
            string,
            { item: ObjectiveItem; deadline: string; observations: string }
          > = {}
          parsed.items.forEach((row) => {
            if (!row?.item?.id) return
            next[row.item.id] = {
              item: row.item,
              deadline: row.deadline ?? "",
              observations: row.observations ?? "",
            }
          })
          return next
        })
        setAvailableChecked(new Set())
        setSelectedChecked(new Set())
        toast.success("Borrador importado.")
      } catch {
        toast.error("No se pudo importar el borrador.")
      }
    }
    reader.readAsText(file)
  }

  const buildPdfDocument = (
    metadata: { entity: string; manager: string },
    groupedRows: [string, typeof selectedRows][],
  ) => {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={pdfStyles.page}>
          <View style={pdfStyles.header}>
            {/* PDF renderer Image is not an HTML img. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={pdfStyles.logo} src="/Gestiona-RGB.png" />
            <View>
              <Text style={pdfStyles.title}>Informe de objetivos 2026</Text>
              <Text style={pdfStyles.meta}>Entidad: {metadata.entity}</Text>
              <Text style={pdfStyles.meta}>Gestor/a: {metadata.manager}</Text>
            </View>
          </View>
          {groupedRows.map(([instruction, rows]) => (
            <View key={instruction} style={pdfStyles.section}>
              <Text style={pdfStyles.instruction}>{instruction}</Text>
              {rows.map(({ item, deadline, observations }) => (
                <View key={item.id} style={pdfStyles.row}>
                  <View style={pdfStyles.rowItem}>
                    <Text style={pdfStyles.rowTitle}>
                      {item.item_objective ?? "Sin objetivo"}
                    </Text>
                  </View>
                  <View style={pdfStyles.rowDeadline}>
                    {deadline ? (
                      <Text style={pdfStyles.rowMeta}>Plazo: {deadline}</Text>
                    ) : null}
                  </View>
                  <View style={pdfStyles.rowObservations}>
                    {observations ? (
                      <Text style={pdfStyles.rowMeta}>
                        Observaciones: {observations}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </Page>
      </Document>
    )
  }

  const handleExportPdf = async (values: z.infer<typeof formSchema>) => {
    if (selectedRows.length === 0) {
      toast.error("Selecciona al menos un item antes de exportar.")
      return
    }

    try {
      const doc = buildPdfDocument(values, groupedSelectedRows)
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const stamp = new Date().toISOString().slice(0, 10)
      const safeEntity = values.entity
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim()
        .replace(/\s+/g, "-")
      const entityPart = safeEntity || "entidad"
      link.href = url
      link.download = `informe-${stamp}-${entityPart}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success("PDF generado correctamente.", {
        description: `${values.entity} • ${values.manager}`,
      })
    } catch {
      toast.error("No se pudo generar el PDF.")
    }
  }

  const onSubmit = form.handleSubmit(
    async (values) => {
      await handleExportPdf(values)
    },
    () => {
      toast.error("Completa los datos de cabecera para exportar.")
    },
  )

  return (
    <section aria-label="Generador de informes" className="flex min-w-0 flex-col gap-6">
      <LocalDraft kind="report" schema={reportDraftSchema} value={reportDraft}
        dirty={Boolean(reportDraft.metadata.entity || reportDraft.metadata.manager || selectedRows.length)}
        onRestore={(draft) => {
          form.reset(draft.metadata)
          setSelectedItems(Object.fromEntries(draft.items.map(row => [row.item.id, row])))
          setAvailableChecked(new Set())
          setSelectedChecked(new Set())
          toast.success("Borrador recuperado. Revisa los ítems antes de exportar.")
        }} />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Generador de informes de objetivos
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Selecciona los items que quieres incluir y completa los datos de
          cabecera para generar el PDF.
        </p>

      </header>

      <div className="grid min-w-0 grid-cols-1 gap-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle>Datos de cabecera</CardTitle>
            <CardDescription>Informacion general para el PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="entity">Entidad</Label>
                <Input
                  id="entity"
                  placeholder="Entidad ejecutora"
                  {...form.register("entity")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager">Gestor/a</Label>
                <Input
                  id="manager"
                  placeholder="Responsable"
                  {...form.register("manager")}
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="relative z-10 border-border bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Items disponibles</CardTitle>
              <CardDescription>
                {itemsLoading
                  ? "Cargando catalogo..."
                  : `${filteredAvailableItems.length} disponibles`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Error al cargar items: {itemsError.message}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-wrap items-end gap-2">
                  <MultiSelectFilter
                    title="Filtrar items disponibles por instruccion"
                    options={instructionOptions}
                    value={availableInstructionFilters}
                    onChange={setAvailableInstructionFilters}
                    placeholder="Todas las instrucciones"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAvailableInstructionFilters([])}
                    disabled={availableInstructionFilters.length === 0}
                  >
                    Eliminar filtros
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <MultiSelectFilter
                    title="Filtrar items disponibles por linea de trabajo"
                    options={availableWorkLineOptions}
                    value={effectiveAvailableWorkLineFilters}
                    onChange={setAvailableWorkLineFilters}
                    placeholder="Todas las lineas"
                    disabled={availableInstructionFilters.length === 0}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAvailableWorkLineFilters([])}
                    disabled={
                      effectiveAvailableWorkLineFilters.length === 0 ||
                      availableInstructionFilters.length === 0
                    }
                  >
                    Eliminar filtros
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={availableChecked.size === 0}
                >
                  Añadir seleccionados
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAllAvailable}
                  disabled={availableItems.length === 0}
                >
                  Añadir todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRestoreAll}
                  disabled={selectedRows.length === 0}
                >
                  Restaurar todo
                </Button>
                <Badge variant="outline">
                  {availableChecked.size} seleccionados
                </Badge>
              </div>
              {filteredAvailableItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {availableItems.length === 0
                    ? "No hay items disponibles. Todo el catalogo esta incluido."
                    : "No hay items disponibles que coincidan con los filtros."}
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {groupedAvailableItems.map(([instruction, items], index) => (
                    <AccordionItem
                      key={`${instruction}-${index}`}
                      value={`available-${index}`}
                      className="rounded-lg border border-border bg-card"
                    >
                      <AccordionTrigger className="px-3 py-2 text-sm font-semibold text-foreground hover:no-underline">
                        <span className="flex w-full items-center justify-between pr-3">
                          <span>{instruction}</span>
                          <Badge variant="outline">{items.length}</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
                          <div className="grid min-w-[48rem] grid-cols-[auto_1.3fr_1fr_1.4fr_0.7fr_auto] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                            <Checkbox
                              checked={
                                items.length === 0
                                  ? false
                                  : items.every((item) => availableChecked.has(item.id))
                                    ? true
                                    : items.some((item) => availableChecked.has(item.id))
                                      ? "indeterminate"
                                      : false
                              }
                              onCheckedChange={(checked) => {
                                const shouldCheck = checked === true
                                setAvailableChecked((prev) => {
                                  const next = new Set(prev)
                                  items.forEach((item) => {
                                    if (shouldCheck) {
                                      next.add(item.id)
                                    } else {
                                      next.delete(item.id)
                                    }
                                  })
                                  return next
                                })
                              }}
                              aria-label="Seleccionar todos los items visibles"
                              disabled={items.length === 0}
                            />
                            <span>Instruccion</span>
                            <span>Linea de trabajo</span>
                            <span>Objetivo de evaluacion</span>
                            <span>ID Objetivo</span>
                            <span>Accion</span>
                          </div>
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="grid min-w-[48rem] grid-cols-[auto_1.3fr_1fr_1.4fr_0.7fr_auto] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                            >
                              <Checkbox
                                checked={availableChecked.has(item.id)}
                                onCheckedChange={(checked) => {
                                  const isChecked = checked === true
                                  setAvailableChecked((prev) => {
                                    const next = new Set(prev)
                                    if (isChecked) {
                                      next.add(item.id)
                                    } else {
                                      next.delete(item.id)
                                    }
                                    return next
                                  })
                                }}
                                aria-label={`Seleccionar ${item.item_objective ?? "item"}`}
                              />
                              <div>
                                <div className="font-medium text-foreground">
                                  {item.instruction}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.matter} · {item.submatter}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.work_line ?? "Sin linea"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.item_objective ?? "Sin objetivo"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.item_id ?? "Sin ID"}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleAddItem(item)}
                              >
                                Añadir
                              </Button>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle>Items del informe</CardTitle>
              <CardDescription>
                {itemsLoading
                  ? "Cargando catalogo..."
                  : `${filteredSelectedRows.length} de ${selectedRows.length} items seleccionados`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-wrap items-end gap-2">
                  <MultiSelectFilter
                    title="Filtrar items del informe por instruccion"
                    options={instructionOptions}
                    value={selectedInstructionFilters}
                    onChange={setSelectedInstructionFilters}
                    placeholder="Todas las instrucciones"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedInstructionFilters([])}
                    disabled={selectedInstructionFilters.length === 0}
                  >
                    Eliminar filtros
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <MultiSelectFilter
                    title="Filtrar items del informe por linea de trabajo"
                    options={selectedWorkLineOptions}
                    value={effectiveSelectedWorkLineFilters}
                    onChange={setSelectedWorkLineFilters}
                    placeholder="Todas las lineas"
                    disabled={selectedInstructionFilters.length === 0}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedWorkLineFilters([])}
                    disabled={
                      effectiveSelectedWorkLineFilters.length === 0 ||
                      selectedInstructionFilters.length === 0
                    }
                  >
                    Eliminar filtros
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveSelected}
                  disabled={selectedChecked.size === 0}
                >
                  Quitar seleccionados
                </Button>
                <Button type="button" variant="ghost" onClick={handleClearSelection}>
                  Quitar todos
                </Button>
                <Badge variant="outline">{selectedRows.length} seleccionados</Badge>
              </div>
              {filteredSelectedRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {selectedRows.length === 0
                    ? "No hay items en el informe."
                    : "No hay items que coincidan con los filtros."}
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {groupedSelectedRows.map(([instruction, rows], index) => (
                    <AccordionItem
                      key={`${instruction}-${index}`}
                      value={`selected-${index}`}
                      className="rounded-lg border border-border bg-card"
                    >
                      <AccordionTrigger className="px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                        <span className="flex w-full items-center justify-between pr-3">
                          <span>{instruction}</span>
                          <Badge variant="outline">{rows.length}</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
                          <div className="grid min-w-[44rem] grid-cols-[auto_1.6fr_1.1fr_1.4fr_auto] gap-3 border-b border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                            <Checkbox
                              checked={
                                rows.length === 0
                                  ? false
                                  : rows.every((row) => selectedChecked.has(row.item.id))
                                    ? true
                                    : rows.some((row) => selectedChecked.has(row.item.id))
                                      ? "indeterminate"
                                      : false
                              }
                              onCheckedChange={(checked) => {
                                const shouldCheck = checked === true
                                setSelectedChecked((prev) => {
                                  const next = new Set(prev)
                                  rows.forEach((row) => {
                                    if (shouldCheck) {
                                      next.add(row.item.id)
                                    } else {
                                      next.delete(row.item.id)
                                    }
                                  })
                                  return next
                                })
                              }}
                              aria-label="Seleccionar todos los items visibles"
                              disabled={rows.length === 0}
                            />
                            <span>Item</span>
                            <span>Plazo</span>
                            <span>Observaciones</span>
                            <span>Accion</span>
                          </div>
                          {rows.map(({ item, deadline, observations }) => (
                            <div
                              key={item.id}
                              className="grid min-w-[44rem] grid-cols-[auto_1.6fr_1.1fr_1.4fr_auto] items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
                            >
                              <Checkbox
                                checked={selectedChecked.has(item.id)}
                                onCheckedChange={(checked) => {
                                  const isChecked = checked === true
                                  setSelectedChecked((prev) => {
                                    const next = new Set(prev)
                                    if (isChecked) {
                                      next.add(item.id)
                                    } else {
                                      next.delete(item.id)
                                    }
                                    return next
                                  })
                                }}
                                aria-label={`Seleccionar ${item.item_objective ?? "item"}`}
                              />
                              <div>
                                <div className="font-medium text-foreground">
                                  {item.item_objective ?? "Sin objetivo"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.work_line ?? "Sin linea"}
                                </div>
                              </div>
                              <Select
                                value={deadline}
                                onValueChange={(value) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      deadline: value,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Plazo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deadlineOptions.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={observations}
                                onChange={(event) =>
                                  setSelectedItems((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      observations: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Observaciones"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                Quitar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border bg-primary/5 text-foreground shadow-lg">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-6 md:flex-row">
          <Button
            type="button"
            className="gap-2"
            onClick={onSubmit}
          >
            <Download className="size-4" />
            Exportar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleExportDraft}
          >
            Guardar borrador
          </Button>
          <input
            ref={draftInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                handleImportDraft(file)
              }
              if (draftInputRef.current) {
                draftInputRef.current.value = ""
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => draftInputRef.current?.click()}
          >
            Importar borrador
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
