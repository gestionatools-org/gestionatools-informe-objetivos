"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { setQueryOwner } from "@/lib/supabase/queries"

type Session = { owner: string; role: "user" | "admin"; expiresAt: number; loginUrl: string }
const Context = createContext<Session | null>(null)
export function useWorkSession() {
  const session = useContext(Context)
  if (!session) throw new Error("Missing work session")
  return session
}

export function WorkSession({ children, ...session }: Session & { children: ReactNode }) {
  const [state, setState] = useState("")
  const [leaving, setLeaving] = useState(false)
  const blocked = useRef(false)
  useLayoutEffect(() => {
    setQueryOwner(session.owner)
    return () => setQueryOwner(undefined)
  }, [session.owner])
  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" })
        if (!active) return
        if (response.status === 401) { blocked.current = true; setState("La sesión ha caducado. Tus borradores locales se conservan."); return }
        if (response.status === 403) { blocked.current = true; setState("Tu cuenta ya no tiene acceso. Tus borradores locales se conservan."); return }
        if (!response.ok) { setState("No se pudo comprobar la sesión. Puedes seguir editando; revisaremos el acceso antes de guardar."); return }
        const info = await response.json()
        if (info.userId !== session.owner || info.role !== session.role) {
          blocked.current = true
          setState("La cuenta o sus permisos han cambiado. Vuelve a iniciar sesión para continuar.")
          return
        }
        blocked.current = false
        setState(info.expiresAt - Date.now() <= 5 * 60 * 1000 ? "La sesión caduca en menos de cinco minutos. Conserva tus cambios antes de volver a iniciar sesión." : "")
      } catch { if (active) setState("Sin conexión para comprobar la sesión. Conservamos los borradores en este navegador.") }
    }
    const flush = () => window.dispatchEvent(new Event("iobjetivos:flush", { cancelable: true }))
    const submit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement
      if (new URL(form.action).pathname !== "/logout") return
      if (!flush()) { event.preventDefault(); return }
      if (document.querySelector('[data-draft-dirty="true"]') && !window.confirm("¿Conservar los borradores en este navegador y cerrar sesión?")) event.preventDefault()
    }
    check()
    const timer = setInterval(check, 30000)
    window.addEventListener("focus", check)
    document.addEventListener("submit", submit, true)
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("submit", submit, true) }
  }, [session.owner, session.role])
  return <Context.Provider value={session}>
    {state && <section role="alert" className="hub-card mb-4 space-y-2 p-4 text-sm">
      <p>{state}</p>
      <button type="button" className="underline" disabled={leaving} onClick={() => {
        if (!window.dispatchEvent(new Event("iobjetivos:flush", { cancelable: true }))) return
        if (!confirm("¿Conservar los borradores y volver a iniciar sesión?")) return
        setLeaving(true)
        location.href = session.loginUrl
      }}>Volver a iniciar sesión</button>
    </section>}
    <div onSubmitCapture={(event) => { if (blocked.current) { event.preventDefault(); event.stopPropagation() } }}>{children}</div>
  </Context.Provider>
}
