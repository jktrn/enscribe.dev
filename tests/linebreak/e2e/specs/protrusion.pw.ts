import { expect, test } from "@playwright/test"
import { measureLines, settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const edges = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
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

      for (const [index, line] of lines.entries()) {
        const rects = [...line.getClientRects()]
        if (rects.length === 0) continue
        const startHang = Number.parseFloat(line.style.marginInlineStart || "0")
        const endHang = Number.parseFloat(line.style.marginInlineEnd || "0")
        if (startHang !== 0 || endHang !== 0) hung += 1
        maxHang = Math.max(maxHang, -startHang, -endHang)

        if (startHang !== 0 && rects.length === 1) {
          checkedStarts += 1
          worstStart = Math.max(
            worstStart,
            Math.abs((rects[0] as DOMRect).left - (left + startHang)),
          )
        }
        const ragged =
          index === lines.length - 1 ||
          line.dataset.linebreakLine === "forced" ||
          rects.length > 1
        if (!ragged && endHang !== 0) {
          checkedEnds += 1
          worstEnd = Math.max(
            worstEnd,
            Math.abs((rects[0] as DOMRect).right - (right - endHang)),
          )
        }
      }
    }
    return { hung, checkedStarts, checkedEnds, worstStart, worstEnd, maxHang }
  })

test("punctuation hangs past the measure on both sides", async ({ page }) => {
  await settleTypeset(page)
  const report = await edges(page)

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
