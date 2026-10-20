import { NextResponse } from "next/server"
import {
  APP_SESSION_COOKIE,
  createLocalSessionCookie,
  sessionFromClaims,
} from "@/lib/hub-sso/session"
import { verifyIncomingHubSsoToken } from "@/lib/hub-sso/verify-incoming-token"

export const runtime = "nodejs"

const requiredEnv = () => {
  const appSessionSecret = process.env.APP_SESSION_SECRET

  if (!appSessionSecret) {
    throw new Error("missing_sso_config")
  }

  return {
    appSessionSecret,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/", url))
  }

  try {
    const { appSessionSecret } = requiredEnv()
    const claims = verifyIncomingHubSsoToken(token)
    const session = sessionFromClaims(claims)
    const cookieValue = await createLocalSessionCookie(session, appSessionSecret)
    const nowSeconds = Math.floor(Date.now() / 1000)
    const maxAge = Math.max(session.exp - nowSeconds, 0)
    const response = NextResponse.redirect(new URL("/", url))

    response.cookies.set({
      name: APP_SESSION_COOKIE,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    })
    response.headers.set("Cache-Control", "no-store")
    response.headers.set("Referrer-Policy", "no-referrer")

    return response
  } catch {
    const response = NextResponse.redirect(new URL("/", url))
    response.cookies.delete(APP_SESSION_COOKIE)
    return response
  }
}
