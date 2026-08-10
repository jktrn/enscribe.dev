import { expect, test } from "@playwright/test"
import { settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const typesetBlocks = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => document.querySelectorAll("[data-linebreak-typeset]").length,
  )

const bodyFamily = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const block = document.querySelector("[data-linebreak-typeset]")
    if (!block) throw new Error("nothing was typeset")
    return getComputedStyle(block).fontFamily
  })

const unlikeBodyFontUrl = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const urls: string[] = []
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of rules) {
        if (!(rule instanceof CSSFontFaceRule)) continue
        const source = rule.style.getPropertyValue("src")
        for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/gu)) {
          if (match[1]?.endsWith(".woff2")) urls.push(match[1])
        }
      }
    }
    const mono = urls.find((url) => /mono/iu.test(url))
    if (!mono)
      throw new Error(`no monospaced face to borrow among ${urls.length}`)
    return mono
  })

const settle = (page: import("@playwright/test").Page) =>
  page.waitForTimeout(1200)

test("loading a face the text never reaches leaves the document set", async ({
  page,
}) => {
  await settleTypeset(page)
  const before = await typesetBlocks(page)
  expect(before).toBeGreaterThan(50)

  await page.evaluate(
    async (family) => {
      await document.fonts.load(`16px ${family}`).catch(() => [])
    },
    await bodyFamily(page),
  )
  await settle(page)

  expect(await typesetBlocks(page)).toBe(before)
})

test("a face that moves the text's own metrics re-sets the document", async ({
  page,
}) => {
  await settleTypeset(page)
  const before = await typesetBlocks(page)
  expect(before).toBeGreaterThan(50)

  const swap = await page.evaluate(
    async ({ family, url }) => {
      const first = family.split(",")[0]?.replace(/["']/gu, "").trim() ?? ""
      const advance = () => {
        const context = document.createElement("canvas").getContext("2d")
        if (!context) return 0
        context.font = `16px ${family}`
        return context.measureText("Hamburgefonstiv the quick brown fox").width
      }
      const before = advance()
      const face = new FontFace(first, `url(${url})`)
      document.fonts.add(face)
      await face.load()
      return { family: first, before, after: advance() }
    },
    { family: await bodyFamily(page), url: await unlikeBodyFontUrl(page) },
  )

  // Guard the premise: if the swap changed nothing, not re-setting is right.
  expect(swap.family).not.toBe("")
  expect(swap.after).not.toBeCloseTo(swap.before, 1)
  await settle(page)

  expect(await typesetBlocks(page)).toBeLessThan(before)
})
