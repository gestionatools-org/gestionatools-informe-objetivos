"use client"

import { GestionaAppShell } from "@gestionatools-org/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Settings } from "lucide-react"
import type { ReactNode } from "react"
import { WorkSession } from "@/components/work-session"

export function AppShell({ children, user, loginUrl }: {
  children: ReactNode; user: { sub: string; name: string | null; email: string; role: "user" | "admin"; exp: number }; loginUrl: string
}) {
  const pathname = usePathname()
  const navItems = [{ href: "/", label: "Generar informe", icon: <FileText className="size-4" />, active: pathname === "/" }]
  if (user.role === "admin") navItems.push({ href: "/admin/dashboard", label: "Administración", icon: <Settings className="size-4" />, active: pathname.startsWith("/admin") })
  return <GestionaAppShell user={{ name: user.name || user.email, email: user.email }} navItems={navItems}
    title="Informe de objetivos" subtitle="Objetivos 2026" brandSubtitle="Informe de objetivos"
    logoutAction="/logout" logoSrc="/isotipo-gestiona-avanza.png"
    renderLink={({ ariaCurrent, ariaLabel, ...props }) => <Link {...props} aria-current={ariaCurrent} aria-label={ariaLabel} />}>
    <WorkSession owner={user.sub} role={user.role} expiresAt={user.exp * 1000} loginUrl={loginUrl}>{children}</WorkSession>
  </GestionaAppShell>
}
