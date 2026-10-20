"use client"

import { useEffect, useRef, useState } from "react"
import type { z } from "zod"
import { DRAFT_TTL_MS, draftKey, loadDrafts } from "@/lib/drafts"
import { useWorkSession } from "@/components/work-session"

export function LocalDraft<T>({ kind, value, dirty, schema, onRestore }: {
  kind: string; value: T; dirty: boolean; schema: z.ZodType<T>; onRestore: (value: T) => void
}) {
  const { owner } = useWorkSession()
  const current = useRef({ value, dirty })
  const key = useRef("")
  const [available, setAvailable] = useState<ReturnType<typeof loadDrafts<T>>>([])
  const [storageError, setStorageError] = useState(false)
  const snapshot = JSON.stringify(value)

  useEffect(() => { current.current = { value, dirty } }, [value, dirty])
  useEffect(() => {
    key.current = draftKey(owner, crypto.randomUUID(), kind)
    const refresh = () => {
      try {
        setAvailable(loadDrafts(localStorage, owner, kind, schema).filter(d => d.key !== key.current))
      } catch { setStorageError(true) }
    }
    const flush = (event?: Event) => {
      try {
        const next = current.current
        if (next.dirty) localStorage.setItem(key.current, JSON.stringify({ version: 1, owner, tab: key.current, kind, modifiedAt: Date.now(), value: next.value }))
        else localStorage.removeItem(key.current)
        setStorageError(false)
      } catch { event?.preventDefault(); setStorageError(true) }
    }
    const unload = (event: BeforeUnloadEvent) => {
      flush()
      if (current.current.dirty) { event.preventDefault(); event.returnValue = "" }
    }
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("iobjetivos:flush", flush)
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", unload)
    return () => {
      flush()
      window.removeEventListener("storage", refresh)
      window.removeEventListener("iobjetivos:flush", flush)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", unload)
    }
  }, [owner, kind, schema])
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event("iobjetivos:flush")), 500)
    return () => clearTimeout(timer)
  }, [snapshot, dirty])

  return <section hidden={!storageError && available.length === 0} data-draft-dirty={dirty} className="space-y-2 text-sm" aria-label="Borradores locales">
    {storageError && <p role="alert" className="text-destructive">No se puede guardar el borrador en este navegador. Mantén la pestaña abierta y exporta un JSON o copia los cambios antes de salir.</p>}
    {available.map(draft => <div key={draft.key} className="hub-card flex flex-wrap items-center gap-3 p-3">
      <span>Borrador local · {new Date(draft.modifiedAt).toLocaleString()}</span>
      <button type="button" className="underline" onClick={() => {
        if (Date.now() - draft.modifiedAt >= DRAFT_TTL_MS) {
          setAvailable(prev => prev.filter(d => d.key !== draft.key))
          return
        }
        if (dirty && !confirm("¿Sustituir los cambios de esta pestaña por el borrador seleccionado?")) return
        onRestore(schema.parse(draft.value))
      }}>Recuperar</button>
      <button type="button" className="underline" onClick={() => {
        if (!confirm("¿Descartar este borrador local?")) return
        try { localStorage.removeItem(draft.key); setAvailable(prev => prev.filter(d => d.key !== draft.key)) }
        catch { setStorageError(true) }
      }}>Descartar</button>
    </div>)}
  </section>
}
