import { expect, test } from "@playwright/test"
import { measureLines, settleTypeset } from "../support/page"
import { PROTRUSION } from "../support/protrusion"

test.use({ viewport: { width: 1440, height: 900 } })

const edges = (
  page: import("@playwright/test").Page,
  table: typeof PROTRUSION,
) =>
  page.evaluate((codes: typeof PROTRUSION) => {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context to measure with")

    const first = (text: string) => {
      for (const character of text) return character
      return ""
    }
    const last = (text: string) => {
      let tail = ""
      for (const character of text) tail = character
      return tail
    }

    let hung = 0
    let checkedStarts = 0
    let checkedEnds = 0
    let worstStart = 0
    let worstEnd = 0
    let maxHang = 0

    for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
      const lines = [
        ...block.querySelectorAll<HTMLElement>(
          ":scope > [data-linebreak-line]",
        ),
      ]
      const style = getComputedStyle(block)
      const box = block.getBoundingClientRect()
      const left =
        box.left +
        Number.parseFloat(style.paddingInlineStart || "0") +
        Number.parseFloat(style.borderInlineStartWidth || "0")
      const right =
        box.right -
        Number.parseFloat(style.paddingInlineEnd || "0") -
        Number.parseFloat(style.borderInlineEndWidth || "0")

      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const spacing = Number.parseFloat(style.letterSpacing) || 0
      const advance = (character: string) =>
        character === "" ? 0 : context.measureText(character).width + spacing
      const hangOf = (character: string, side: "l" | "r") => {
        const code = codes[character]?.[side] ?? 0
        return code === 0 ? 0 : (code / 1000) * advance(character)
      }

      for (const [index, line] of lines.entries()) {
        const rects = [...line.getClientRects()]
        if (rects.length === 0) continue
        if (line.style.marginInlineStart || line.style.marginInlineEnd)
          hung += 1
        maxHang = Math.max(
          maxHang,
          -Number.parseFloat(line.style.marginInlineStart || "0"),
          -Number.parseFloat(line.style.marginInlineEnd || "0"),
        )

        const text = (line.textContent ?? "").trim()
        const hyphen = line.dataset.linebreakLine === "hyphen"
        const wantStart = hangOf(first(text), "l")
        const wantEnd = hyphen ? hangOf("-", "r") : hangOf(last(text), "r")

        if (wantStart > 0 && rects.length === 1) {
          checkedStarts += 1
          worstStart = Math.max(
            worstStart,
            Math.abs((rects[0] as DOMRect).left - (left - wantStart)),
          )
        }
        const ragged =
          index === lines.length - 1 ||
          line.dataset.linebreakLine === "forced" ||
          rects.length > 1
        if (!ragged && wantEnd > 0) {
          checkedEnds += 1
          worstEnd = Math.max(
            worstEnd,
            Math.abs((rects[0] as DOMRect).right - (right + wantEnd)),
          )
        }
      }
    }
    return { hung, checkedStarts, checkedEnds, worstStart, worstEnd, maxHang }
  }, table)

test("punctuation hangs past the measure on both sides", async ({ page }) => {
  await settleTypeset(page)
  const report = await edges(page, PROTRUSION)

  expect(report.hung).toBeGreaterThan(50)
  expect(report.checkedStarts).toBeGreaterThan(0)
  expect(report.checkedEnds).toBeGreaterThan(20)
  expect(report.worstStart).toBeLessThanOrEqual(0.5)
  expect(report.worstEnd).toBeLessThanOrEqual(0.5)
  expect(report.maxHang).toBeLessThan(12)
})

test("a hanging glyph is not mistaken for overflow", async ({ page }) => {
  await settleTypeset(page)
  const report = await measureLines(page)

  expect(report.hangingLines).toBeGreaterThan(50)
  expect(report.overflowingBlocks).toBeGreaterThan(0)
  expect(report.unhungOverflowBlocks).toBe(0)
  expect(report.worstUnhungOverflowPx).toBe(0)
  expect(report.wrappedBlocks).toBe(0)
})

test("protrusion does not cost a retry or a failure", async ({ page }) => {
  await settleTypeset(page)

  const outcomes = await page.evaluate(() => {
    const counts: Record<string, number> = {}
    for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
      const key = block.getAttribute("data-linebreak-typeset") ?? "0"
      counts[key] = (counts[key] ?? 0) + 1
    }
    return {
      typeset: document.querySelectorAll("[data-linebreak-typeset]").length,
      empty: counts["0"] ?? 0,
    }
  })

  expect(outcomes.typeset).toBeGreaterThan(50)
  expect(outcomes.empty).toBe(0)
})
