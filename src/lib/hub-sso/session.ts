import type { HubSsoTokenClaimsV2 } from "@gestionatools-org/hub-sso-core"

export const APP_SESSION_COOKIE = "hub_app_session"
export const LOCAL_SESSION_SECONDS = 8 * 60 * 60

export type LocalSession = Pick<
  HubSsoTokenClaimsV2,
  "sub" | "email" | "app_id"
> & {
  name: string | null
  global_role: "admin" | "user" | null
  exp: number
  sessionVersion?: 2
  authenticatedAt?: number
  ssoExpiresAt?: number
}

export function sessionFromClaims(claims: HubSsoTokenClaimsV2, now = Math.floor(Date.now() / 1000)): LocalSession {
  return {
    sub: claims.sub, email: claims.email, name: claims.name ?? null,
    global_role: claims.global_role ?? null, app_id: claims.app_id,
    exp: now + LOCAL_SESSION_SECONDS, sessionVersion: 2,
    authenticatedAt: now, ssoExpiresAt: claims.exp,
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  const binary = atob(`${normalized}${padding}`)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const sign = async (payloadPart: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadPart),
  )
  return bytesToBase64Url(new Uint8Array(signature))
}

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return result === 0
}

const parseJsonPart = <T>(value: string): T => {
  return JSON.parse(decoder.decode(base64UrlToBytes(value))) as T
}

const encodeJsonPart = (value: unknown) => {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)))
}

export const createLocalSessionCookie = async (
  session: LocalSession,
  secret = process.env.APP_SESSION_SECRET,
) => {
  if (!secret) {
    throw new Error("missing_app_session_secret")
  }

  const payloadPart = encodeJsonPart(session)
  const signaturePart = await sign(payloadPart, secret)
  return `${payloadPart}.${signaturePart}`
}

export const verifyLocalSessionCookie = async (
  cookie: string | undefined,
  secret = process.env.APP_SESSION_SECRET,
) => {
  if (!cookie || !secret) return null

  const [payloadPart, signaturePart] = cookie.split(".")
  if (!payloadPart || !signaturePart || cookie.split(".").length !== 2) {
    return null
  }

  const expectedSignature = await sign(payloadPart, secret)
  if (!safeEqual(expectedSignature, signaturePart)) {
    return null
  }

  try {
    const session = parseJsonPart<LocalSession>(payloadPart)
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (!session || typeof session.exp !== "number" || !Number.isFinite(session.exp) || session.exp <= nowSeconds
      || typeof session.sub !== "string" || !session.sub || typeof session.email !== "string"
      || typeof session.app_id !== "string" || !process.env.HUB_APP_ID || session.app_id !== process.env.HUB_APP_ID
      || (session.name !== null && typeof session.name !== "string")
      || ![null, "admin", "user"].includes(session.global_role)) {
      return null
    }
    if (session.sessionVersion !== undefined && session.sessionVersion !== 2) return null
    if (session.sessionVersion === 2 && (
      !Number.isFinite(session.authenticatedAt) || !Number.isFinite(session.ssoExpiresAt)
      || session.authenticatedAt! > nowSeconds || session.ssoExpiresAt! <= session.authenticatedAt!
      || session.exp !== session.authenticatedAt! + LOCAL_SESSION_SECONDS
    )) return null
    return session
  } catch {
    return null
  }
}
