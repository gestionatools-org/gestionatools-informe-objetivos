import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer, type Server } from "node:http"
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { generateKeyPairSync } from "node:crypto"
import { signHubSsoTokenV2 } from "@gestionatools-org/hub-sso-core"
import { APP_SESSION_COOKIE, createLocalSessionCookie } from "../../src/lib/hub-sso/session"
import { checkVisualIntegration } from "./visual-integration"

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Missing test port")
  return address.port
}

test("production routes preserve SSO and enforce local roles with mocked Supabase", { timeout: 90000 }, async () => {
  let role: "user" | "admin" | null = "user"
  let status = "activo"
  const db = createServer((req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname
    res.setHeader("content-type", "application/json")
    if (path.endsWith("/app_users")) {
      assert.equal(req.headers["accept-profile"], "iobjetivos")
      res.end(JSON.stringify(role ? [{ role }] : []))
    } else if (path.endsWith("/usuarios_gtools")) {
      assert.equal(req.headers["accept-profile"], "public")
      res.end(JSON.stringify([{ status }]))
    } else if (path.endsWith("/informeobjetivos_v_items_export")) {
      res.end(JSON.stringify([{
        item_uuid: "00000000-0000-4000-8000-000000000010", item_legacy_id: "item-1", item_code: "OBJ-001",
        title: "Objetivo de prueba", status: null, year: 2026,
        instruction_id: "00000000-0000-4000-8000-000000000020", instruction: "Instrucción de prueba",
        instruction_legacy_id: "instruction-1", commission: "Comisión", matter: "Materia", submatter: "Submateria",
        work_line_id: "00000000-0000-4000-8000-000000000030", work_line_code: "WL", work_line: "Línea de prueba",
        work_line_legacy_id: "line-1", work_line_sort_order: 1,
      }]))
    } else if (path.includes("/informeobjetivos_")) {
      res.end("[]")
    } else {
      res.statusCode = 500
      res.end(JSON.stringify({ message: "Unexpected test database request" }))
    }
  })
  const dbPort = await listen(db)
  const reservation = createServer()
  const port = await listen(reservation)
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  const base = `http://127.0.0.1:${port}`
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
  const appSecret = "smoke-test-secret-only"
  const require = createRequire(import.meta.url)
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", SUPABASE_URL: `http://127.0.0.1:${dbPort}`, SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
      HUB_BASE_URL: "https://hub.example.test", HUB_APP_ID: "test-app", HUB_SSO_ISSUER: "https://hub.example.test",
      HUB_SSO_PUBLIC_KEY: publicKey, APP_BASE_URL: base, APP_SESSION_SECRET: appSecret },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  child.stdout.on("data", data => { output += data })
  child.stderr.on("data", data => { output += data })
  const request = (path: string, cookie?: string, method = "GET") => fetch(base + path, { method, redirect: "manual", headers: cookie ? { cookie: `${APP_SESSION_COOKIE}=${cookie}` } : {} })
  try {
    let ready = false
    for (let i = 0; i < 100; i++) {
      try { if ((await request("/api/session")).status === 401) { ready = true; break } } catch { /* Starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, output)
    const guest = await request("/")
    assert.equal(guest.status, 307)
    assert.equal(guest.headers.get("location"), "https://hub.example.test/sso?app=test-app")
    const now = Math.floor(Date.now() / 1000)
    const claims = { v: 2 as const, alg: "EdDSA" as const, iss: "https://hub.example.test", aud: `127.0.0.1:${port}`,
      sub: "00000000-0000-4000-8000-000000000001", app_id: "test-app", email: "user@example.test", name: "Test User",
      global_role: "admin" as const, iat: now, exp: now + 600, jti: "smoke-test" }
    const sso = await request(`/sso?token=${encodeURIComponent(signHubSsoTokenV2(claims, { privateKey }))}`)
    assert.equal(sso.status, 307)
    assert.match(sso.headers.get("set-cookie") || "", /Max-Age=28800/)
    const cookie = sso.headers.get("set-cookie")!.split(";")[0].split("=").slice(1).join("=")
    const session = await request("/api/session", cookie)
    assert.equal(session.status, 200)
    assert.equal((await session.json()).role, "user") // global admin does not grant local admin.
    const page = await request("/", cookie)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Generador de informes de objetivos/)
    assert.equal(new URL((await request("/admin/dashboard", cookie)).headers.get("location")!, base).pathname, "/acceso-denegado")
    role = "admin"
    assert.equal((await request("/admin/dashboard", cookie)).status, 200)
    role = null
    assert.equal((await request("/api/session", cookie)).status, 403)
    role = "user"; status = "inactivo"
    assert.equal((await request("/api/session", cookie)).status, 403)
    status = "activo"
    const expired = await createLocalSessionCookie({ ...claims, exp: now - 1 }, appSecret)
    assert.equal((await request("/api/session", expired)).status, 401)
    assert.equal((await request("/api/session", cookie + "tampered")).status, 401)
    const invalidSso = await request(`/sso?token=${encodeURIComponent(signHubSsoTokenV2({ ...claims, aud: "wrong-app" }, { privateKey }))}`)
    assert.match(invalidSso.headers.get("set-cookie") || "", /hub_app_session=;/)
    const loggedOut = await request("/logout", cookie, "POST")
    assert.equal(loggedOut.status, 303)
    assert.equal(loggedOut.headers.get("location"), "https://hub.example.test/")
    assert.match(loggedOut.headers.get("set-cookie") || "", /Max-Age=0/)
    assert.equal((await request("/isotipo-gestiona-avanza.png")).status, 200)
    if (process.env.IOBJETIVOS_BROWSER_TESTS === "1") {
      const { chromium } = await import("playwright")
      const browser = await chromium.launch({ headless: true, executablePath: process.env.IOBJETIVOS_TEST_CHROMIUM || undefined })
      try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
        await context.addCookies([{ name: APP_SESSION_COOKIE, value: cookie, url: base, httpOnly: true, sameSite: "Lax" }])
        const page = await context.newPage()
        const errors: string[] = []
        page.on("pageerror", error => errors.push(error.message))
        page.on("dialog", dialog => dialog.accept())
        await page.goto(base)
        await page.getByRole("button", { name: /Instrucción de prueba/ }).click()
        await checkVisualIntegration(page, "generator")
        await page.getByLabel("Entidad", { exact: true }).fill("Entidad de prueba")
        await page.getByLabel("Gestor/a", { exact: true }).fill("Gestora de prueba")
        await page.getByRole("button", { name: "Añadir todos", exact: true }).click()
        await page.getByRole("button", { name: /Instrucción de prueba/ }).click()
        await page.getByRole("combobox").click()
        await page.getByRole("option", { name: "Año completo", exact: true }).click()
        await page.getByPlaceholder("Observaciones").fill("Observación recuperable")
        await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith("iobjetivos:draft:") && localStorage.getItem(key)?.includes("Observación recuperable")))
        await page.reload()
        await page.getByRole("button", { name: "Recuperar", exact: true }).first().click()
        assert.equal(await page.getByLabel("Entidad", { exact: true }).inputValue(), "Entidad de prueba")
        await page.getByRole("button", { name: /Instrucción de prueba/ }).click()
        assert.equal(await page.getByPlaceholder("Observaciones").inputValue(), "Observación recuperable")
        assert.match(await page.getByRole("combobox").innerText(), /Año completo/)
        await checkVisualIntegration(page, "generator", false)
        const downloadPromise = page.waitForEvent("download")
        await page.getByRole("button", { name: "Exportar PDF", exact: true }).click()
        const download = await downloadPromise
        assert.match(download.suggestedFilename(), /\.pdf$/)
        assert.equal(await download.failure(), null)
        const jsonPromise = page.waitForEvent("download")
        await page.getByRole("button", { name: "Guardar borrador", exact: true }).click()
        assert.match((await jsonPromise).suggestedFilename(), /\.json$/)
        const otherTab = await context.newPage()
        otherTab.on("dialog", dialog => dialog.accept())
        await otherTab.goto(base)
        await otherTab.getByLabel("Entidad", { exact: true }).fill("Entidad en otra pestaña")
        await otherTab.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith("iobjetivos:draft:") && localStorage.getItem(key)?.includes("Entidad en otra pestaña")))
        assert.equal(await page.getByLabel("Entidad", { exact: true }).inputValue(), "Entidad de prueba")
        assert.equal(await otherTab.getByLabel("Gestor/a", { exact: true }).inputValue(), "")
        await otherTab.close()
        await context.addCookies([{ name: APP_SESSION_COOKIE, value: expired, url: base, httpOnly: true }])
        await page.evaluate(() => window.dispatchEvent(new Event("focus")))
        await page.getByText("La sesión ha caducado. Tus borradores locales se conservan.", { exact: true }).waitFor()
        assert.equal(await page.getByLabel("Entidad", { exact: true }).inputValue(), "Entidad de prueba")
        assert.equal(new URL(page.url()).pathname, "/")
        await context.addCookies([{ name: APP_SESSION_COOKIE, value: cookie, url: base, httpOnly: true }])
        role = "admin"
        await page.goto(base + "/admin/dashboard")
        await page.getByRole("button", { name: "Editar", exact: true }).waitFor()
        await checkVisualIntegration(page, "admin")
        await page.locator('input[name="title"]').fill("Edición pendiente")
        await page.waitForFunction(() => Object.keys(localStorage).some(key => key.includes("catalog-item") && localStorage.getItem(key)?.includes("Edición pendiente")))
        await page.reload()
        await page.getByRole("button", { name: "Recuperar", exact: true }).first().click()
        assert.equal(await page.locator('input[name="title"]').inputValue(), "Edición pendiente")
        await page.evaluate(() => {
          Storage.prototype.setItem = () => { throw new DOMException("Storage unavailable", "QuotaExceededError") }
        })
        await page.locator('input[name="title"]').fill("Edición con almacenamiento bloqueado")
        await page.getByText(/No se puede guardar el borrador en este navegador/).waitFor()
        assert.equal(await page.locator('input[name="title"]').inputValue(), "Edición con almacenamiento bloqueado")
        await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click()
        assert.equal(new URL(page.url()).pathname, "/admin/dashboard")
        assert.deepEqual(errors, [])
        await context.close()
      } finally { await browser.close() }
    }
  } finally {
    child.kill("SIGTERM")
    await new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once("exit", () => resolve()) })
    await new Promise<void>(resolve => db.close(() => resolve()))
  }
})
