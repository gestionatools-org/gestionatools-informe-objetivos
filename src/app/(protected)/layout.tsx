import { requireAppUser, getHubLoginUrl } from "@/lib/access"
import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAppUser()
  return <AppShell key={user.sub} user={user} loginUrl={getHubLoginUrl()}>{children}</AppShell>
}
