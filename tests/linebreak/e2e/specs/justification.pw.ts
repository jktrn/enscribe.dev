import { expect, test } from "@playwright/test"
import { measureLines, settleTypeset, sweepViewport } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

/**
 * These are the guarantees the whole architecture rests on.
 *
 * This package chooses where lines break and hands the space distribution to
 * the browser, via `text-align: justify` plus `text-align-last: justify` on a
 * block box per line. That was verified across all three engines before the
 * rewrite was written; this spec is what stops it regressing.
 */
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

  // Justification requires wrapping to stay enabled, so an over-wide line wraps
  // rather than overflowing — and `scrollWidth` cannot see that. Height is the
  // only reliable signal, which is why the library checks it and why this
  // assertion is the one that matters.
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
      for (const line of block.querySelectorAll<HTMLElement>(
        ":scope > .lb-line",
      )) {
        const ragged = getComputedStyle(line).textAlignLast !== "justify"
        if (line.classList.contains("lb-line-flush")) {
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

  // The paragraph's last line, and any line a `<br>` ended.
  expect(ragged.flush).toBeGreaterThan(50)
  expect(ragged.raggedFlush).toBe(ragged.flush)
  // Every other line is stretched to the measure.
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
        ':scope > .lb-line[data-linebreak-break="forced"]',
      )
      if (forced.length === 0) continue
      blocksWithBreaks += 1
      forcedLines += forced.length
    }
    return { blocksWithBreaks, forcedLines }
  })

  // The concert list separates artists, date and genres with `<br>`.
  expect(report.blocksWithBreaks).toBeGreaterThan(0)
  expect(report.forcedLines).toBeGreaterThan(report.blocksWithBreaks)
})

test("hyphens are drawn, and never as text nodes", async ({ page }) => {
  await settleTypeset(page)
  const report = await measureLines(page)

  // This site opts into hyphenation: without breaks available inside long
  // words the optimizer can only stretch spaces, which leaves rivers.
  expect(report.hyphenLines).toBeGreaterThan(0)

  const hyphen = await page.evaluate(() => {
    const line = document.querySelector("[data-linebreak-typeset] > .lb-hyphen")
    if (!line) return null
    return {
      generated: getComputedStyle(line, "::after").content,
      // The character must not exist as a node, or it would enter innerText,
      // the clipboard and find-in-page.
      inTextContent: (line.textContent ?? "").endsWith("-"),
    }
  })

  expect(hyphen?.generated).toBe('"-"')
  expect(hyphen?.inTextContent).toBe(false)
})

test("typesetting survives a resize", async ({ page }) => {
  await settleTypeset(page)
  await page.setViewportSize({ width: 1040, height: 900 })
  // The harness tears down on resize and rebuilds once the measure settles;
  // the sweep waits for that rebuild rather than for a fixed delay.
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

  // The library declines a measure too narrow to justify well rather than
  // producing a column of rivers.
  expect(narrow).toBe(0)
})
