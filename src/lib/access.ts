import "server-only"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { localRole, canUseDatabase } from "@/lib/access-policy"

export function getHubLoginUrl() {
  const base = process.env.HUB_BASE_URL
  const app = process.env.HUB_APP_ID
  if (!base || !app) throw new Error("Missing Hub configuration")
  const url = new URL("/sso", base)
  url.searchParams.set("app", app)
  return url.toString()
}

export async function getAppAccess() {
  const session = await getCurrentUser()
  if (!session) return { status: 401 as const, user: null }
  const db = getSupabaseServerClient()
  const [local, hub] = await Promise.all([
    db.from("app_users").select("role").eq("hub_user_id", session.sub).maybeSingle(),
    db.schema("public").from("usuarios_gtools").select("status").eq("id", session.sub).maybeSingle(),
  ])
  if (local.error || hub.error) throw new Error("Authorization lookup failed")
  const role = localRole(local.data, hub.data)
  if (!role) {
    return { status: 403 as const, user: null }
  }
  return { status: 200 as const, user: { ...session, role } }
}

export async function requireAppUser(admin = false) {
  const access = await getAppAccess()
  if (access.status === 401) redirect(getHubLoginUrl())
  if (!access.user || (admin && access.user.role !== "admin")) redirect("/acceso-denegado")
  return access.user
}

export async function authorizedDatabase(admin: boolean, expectedOwner: string) {
  const access = await getAppAccess()
  if (!access.user) throw new Error(access.status === 401 ? "session_expired" : "access_denied")
  if (!canUseDatabase(access.user, expectedOwner, admin)) throw new Error("access_denied_or_account_changed")
  return getSupabaseServerClient()
}
