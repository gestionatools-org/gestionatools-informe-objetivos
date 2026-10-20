import { NextResponse } from "next/server"
import { getAppAccess, getHubLoginUrl } from "@/lib/access"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { status, user } = await getAppAccess()
    return NextResponse.json(user ? {
      userId: user.sub, role: user.role, expiresAt: user.exp * 1000, loginUrl: getHubLoginUrl(),
    } : { error: status === 401 ? "session_expired" : "access_denied" }, {
      status, headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json({ error: "session_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
