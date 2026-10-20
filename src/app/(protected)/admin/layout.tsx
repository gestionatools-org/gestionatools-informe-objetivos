import { requireAppUser } from "@/lib/access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser(true)
  return children
}
