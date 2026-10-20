import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  APP_SESSION_COOKIE,
  verifyLocalSessionCookie,
} from "@/lib/hub-sso/session"

const publicPathPrefixes = ["/sso", "/logout"]

const redirectToHub = () => {
  const hubBaseUrl = process.env.HUB_BASE_URL
  const hubAppId = process.env.HUB_APP_ID

  if (!hubBaseUrl || !hubAppId) {
    return new NextResponse("Missing SSO configuration", { status: 500 })
  }

  const hubUrl = new URL("/sso", hubBaseUrl)
  hubUrl.searchParams.set("app", hubAppId)
  const response = NextResponse.redirect(hubUrl)
  response.cookies.delete(APP_SESSION_COOKIE)
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPathPrefixes.some((prefix) => pathname === prefix)) {
    return NextResponse.next()
  }

  const session = await verifyLocalSessionCookie(
    request.cookies.get(APP_SESSION_COOKIE)?.value,
    process.env.APP_SESSION_SECRET,
  )

  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "session_expired" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    return redirectToHub()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|Gestiona-RGB.png|isotipo-gestiona-avanza.png|robots.txt).*)",
  ],
}
