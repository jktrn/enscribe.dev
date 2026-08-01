import { expect, test } from "@playwright/test"
import { measureLines, settleTypeset, sweepViewport } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

test("every justified line fills the measure", async ({ page }) => {
  await settleTypeset(page)
  const report = await measureLines(page)

  expect(report.typesetBlocks).toBeGreaterThan(50)
  expect(report.totalLines).toBeGreaterThan(200)
  expect(report.shortLines).toBe(0)
  expect(report.worstGapPx).toBeLessThanOrEqual(1.5)
})

test("no line overflows or wraps", async ({ page }) => {
  await settleTypeset(page)
  const report = await measureLines(page)

  expect(report.wrappedBlocks).toBe(0)
  expect(report.overflowingBlocks).toBe(0)
})

test("a line that ends a run of text stays ragged", async ({ page }) => {
  await settleTypeset(page)

  const ragged = await page.evaluate(() => {
    let flush = 0
    let raggedFlush = 0
    let stretched = 0
    let raggedStretched = 0
    for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
      const lines = [
        ...block.querySelectorAll<HTMLElement>(
          ":scope > [data-linebreak-line]",
        ),
      ]
      for (const [index, line] of lines.entries()) {
        const ragged = getComputedStyle(line).textAlignLast !== "justify"
        const isFlush =
          index === lines.length - 1 || line.dataset.linebreakLine === "forced"
        if (isFlush) {
          flush += 1
          if (ragged) raggedFlush += 1
        } else {
          stretched += 1
          if (ragged) raggedStretched += 1
        }
      }
    }
    return { flush, raggedFlush, stretched, raggedStretched }
  })

  expect(ragged.flush).toBeGreaterThan(50)
  expect(ragged.raggedFlush).toBe(ragged.flush)

  expect(ragged.stretched).toBeGreaterThan(50)
  expect(ragged.raggedStretched).toBe(0)
})

test("an authored line break ends its line", async ({ page }) => {
  await settleTypeset(page, "/music")

  const report = await page.evaluate(() => {
    let blocksWithBreaks = 0
    let forcedLines = 0
    for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
      const forced = block.querySelectorAll(
        ':scope > [data-linebreak-line="forced"]',
      )
      if (forced.length === 0) continue
      blocksWithBreaks += 1
      forcedLines += forced.length
    }
    return { blocksWithBreaks, forcedLines }
  })

  expect(report.blocksWithBreaks).toBeGreaterThan(0)
  expect(report.forcedLines).toBeGreaterThan(report.blocksWithBreaks)
})

test("hyphens are drawn, and never as text nodes", async ({ page }) => {
  await settleTypeset(page)
  const report = await measureLines(page)

  expect(report.hyphenLines).toBeGreaterThan(0)

  const hyphen = await page.evaluate(() => {
    const line = document.querySelector(
      '[data-linebreak-typeset] > [data-linebreak-line="hyphen"]',
    )
    if (!line) return null
    return {
      generated: getComputedStyle(line, "::after").content,

      inTextContent: (line.textContent ?? "").endsWith("-"),
    }
  })

  // U+2010 HYPHEN, not the U+002D hyphen-minus a keyboard produces.
  expect(hyphen?.generated).toBe('"\u2010"')
  expect(hyphen?.inTextContent).toBe(false)
})

test("typesetting survives a resize", async ({ page }) => {
  await settleTypeset(page)
  await page.setViewportSize({ width: 1040, height: 900 })

  await sweepViewport(page)

  const report = await measureLines(page)
  expect(report.typesetBlocks).toBeGreaterThan(50)
  expect(report.wrappedBlocks).toBe(0)
  expect(report.overflowingBlocks).toBe(0)
  expect(report.shortLines).toBe(0)
})

test("nothing narrower than the minimum measure is typeset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 900 })
  await settleTypeset(page)

  const narrow = await page.evaluate(() => {
    let belowMinimum = 0
    for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
      const style = getComputedStyle(block)
      const width =
        block.clientWidth -
        Number.parseFloat(style.paddingInlineStart) -
        Number.parseFloat(style.paddingInlineEnd)
      if (width < 240) belowMinimum += 1
    }
    return belowMinimum
  })

  expect(narrow).toBe(0)
})
