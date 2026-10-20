export type AppRole = "user" | "admin"

export function localRole(local: { role: unknown } | null, hub: { status: unknown } | null): AppRole | null {
  if (hub?.status !== "activo") return null
  return local?.role === "user" || local?.role === "admin" ? local.role : null
}

export function canUseDatabase(user: { sub: string; role: AppRole }, expectedOwner: string, admin: boolean) {
  return user.sub === expectedOwner && (!admin || user.role === "admin")
}
