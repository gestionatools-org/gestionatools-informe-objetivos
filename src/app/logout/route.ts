import { NextResponse } from "next/server"
import { APP_SESSION_COOKIE } from "@/lib/hub-sso/session"

const clearSession = () => {
  const response = NextResponse.redirect("https://gestionatools.com/catalogo", 303)
  response.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 0,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}

export function GET() {
  return clearSession()
}

export function POST() {
  return clearSession()
}
