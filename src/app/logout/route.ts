import { NextResponse } from "next/server"
import { APP_SESSION_COOKIE } from "@/lib/hub-sso/session"

const clearSession = (request: Request) => {
  const url = new URL(request.url)
  const hubBaseUrl = process.env.HUB_BASE_URL
  if (!hubBaseUrl) return new NextResponse("Missing HUB_BASE_URL", { status: 500 })
  const response = NextResponse.redirect(new URL(hubBaseUrl, url), 303)
  response.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 0,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}

export function GET(request: Request) {
  return clearSession(request)
}

export function POST(request: Request) {
  return clearSession(request)
}
