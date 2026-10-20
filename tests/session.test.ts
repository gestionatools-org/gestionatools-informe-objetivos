import assert from "node:assert/strict"
import { test } from "node:test"
import { APP_SESSION_COOKIE, LOCAL_SESSION_SECONDS, createLocalSessionCookie, sessionFromClaims, verifyLocalSessionCookie, type LocalSession } from "../src/lib/hub-sso/session"
import { POST as logout } from "../src/app/logout/route"

process.env.APP_SESSION_SECRET = "test-only-session-secret"
process.env.HUB_APP_ID = "test-app"
process.env.HUB_BASE_URL = "https://hub.example.test/tools"

const now = () => Math.floor(Date.now() / 1000)
const legacy = (): LocalSession => ({ sub: "hub-user-id", email: "user@example.test", name: "User", app_id: "test-app", global_role: "user", exp: now() + 600 })

test("local session lasts eight hours independently of the SSO handoff", async () => {
  const claims = { ...legacy(), v: 2, alg: "EdDSA", iss: "hub", aud: "app", iat: now() - 30, jti: "test" } as Parameters<typeof sessionFromClaims>[0]
  const session = sessionFromClaims(claims)
  assert.equal(session.exp, session.authenticatedAt! + LOCAL_SESSION_SECONDS)
  const ssoExpiredSession = { ...session, authenticatedAt: now() - 700, ssoExpiresAt: now() - 100, exp: now() - 700 + LOCAL_SESSION_SECONDS }
  assert.deepEqual(await verifyLocalSessionCookie(await createLocalSessionCookie(ssoExpiredSession)), ssoExpiredSession)
})

test("legacy cookies retain their original expiry", async () => {
  const session = legacy()
  assert.deepEqual(await verifyLocalSessionCookie(await createLocalSessionCookie(session)), session)
  session.exp = now() - 1
  assert.equal(await verifyLocalSessionCookie(await createLocalSessionCookie(session)), null)
})

test("tampering, unknown app, malformed payload, expiry and invalid version fail closed", async () => {
  const valid = await createLocalSessionCookie(legacy())
  assert.equal(await verifyLocalSessionCookie(valid + "tampered"), null)
  assert.equal(await verifyLocalSessionCookie("bad.payload.extra"), null)
  assert.equal(await verifyLocalSessionCookie(undefined), null)
  for (const changes of [{ app_id: "other-app" }, { exp: now() - 1 }, { exp: null }, { global_role: "owner" }, { sessionVersion: 3 }, { sessionVersion: 2, authenticatedAt: now(), ssoExpiresAt: now() + 1, exp: now() + 9 * 3600 }]) {
    const signed = await createLocalSessionCookie({ ...legacy(), ...changes } as LocalSession)
    assert.equal(await verifyLocalSessionCookie(signed), null)
  }
  assert.equal(await verifyLocalSessionCookie(await createLocalSessionCookie(null as unknown as LocalSession)), null)
})

test("logout clears the local cookie and redirects to HUB_BASE_URL without SSO re-entry", () => {
  const response = logout(new Request("https://app.example.test/logout", { method: "POST" }))
  assert.equal(response.status, 303)
  assert.equal(response.headers.get("location"), process.env.HUB_BASE_URL)
  assert.equal(response.cookies.get(APP_SESSION_COOKIE)?.value, "")
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/)
})
