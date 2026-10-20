import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { Page } from "playwright"

export async function checkVisualIntegration(page: Page, screen: "generator" | "admin", capture = true) {
  await page.evaluate(() => document.fonts.ready)
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send("DOM.enable")
    await cdp.send("CSS.enable")
    const { root } = await cdp.send("DOM.getDocument")
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "h1" })
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId })
    assert.ok(fonts.some(font => font.isCustomFont && /Geist/i.test(font.familyName)), JSON.stringify(fonts))
  } finally { await cdp.detach() }

  const directory = capture ? process.env.IOBJETIVOS_SCREENSHOT_DIR : undefined
  if (directory) await mkdir(directory, { recursive: true })
  for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme })
      await page.waitForFunction(dark => document.documentElement.classList.contains("dark") === dark, theme === "dark")
      await page.evaluate(async () => {
        window.scrollTo(0, 0)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      })
      const metrics = await page.evaluate(() => {
        const main = document.querySelector("main")!
        const section = main.querySelector('section[aria-label="Generador de informes"], section[aria-label="Administración del catálogo"]')!
        const heading = main.querySelector("h1")!
        const mainStyle = getComputedStyle(main)
        return {
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          expectedLeft: main.getBoundingClientRect().left + parseFloat(mainStyle.paddingLeft),
          contentLeft: section.getBoundingClientRect().left,
          headingLeft: heading.getBoundingClientRect().left,
          fonts: ["body", "h1", "input", "main button", "nav a"].map(selector => getComputedStyle(document.querySelector(selector)!).fontFamily),
          overflowing: [...document.querySelectorAll("main *")].filter(element => {
            const rect = element.getBoundingClientRect()
            return rect.width && rect.right > innerWidth + 1 && !element.closest('[class*="overflow-x-auto"]')
          }).slice(0, 8).map(element => ({ tag: element.tagName, classes: element.className })),
        }
      })
      assert.ok(metrics.fonts.every(font => /Geist/i.test(font)), JSON.stringify(metrics.fonts))
      assert.ok(metrics.scrollWidth <= metrics.width + 1, `${screen}/${viewport.name}/${theme}: page overflows ${JSON.stringify(metrics)}`)
      assert.ok(Math.abs(metrics.contentLeft - metrics.expectedLeft) <= 1, JSON.stringify(metrics))
      assert.ok(Math.abs(metrics.headingLeft - metrics.expectedLeft) <= 1, JSON.stringify(metrics))
      if (directory) await page.screenshot({ path: join(directory, `${screen}-${viewport.name}-${theme}.png`), fullPage: true })
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ colorScheme: "light" })
}
