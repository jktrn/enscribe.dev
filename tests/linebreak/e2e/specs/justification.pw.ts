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
  expect(report.unhungOverflowBlocks).toBe(0)
})

type RaggedReport = {
  flush: number
  raggedFlush: number
  stretched: number
  raggedStretched: number
}

const raggedReport = (): RaggedReport => {
  const rightOf = (block: Element) => {
    const style = getComputedStyle(block)
    return (
      block.getBoundingClientRect().right -
      Number.parseFloat(style.paddingInlineEnd || "0") -
      Number.parseFloat(style.borderInlineEndWidth || "0")
    )
  }

  const reachesEnd = (line: HTMLElement, right: number) => {
    const rects = [...line.getClientRects()]
    if (rects.length === 0) return null
    return right - Math.max(...rects.map((rect) => rect.right)) <= 2
  }

  const tallyLine = (
    line: HTMLElement,
    isLast: boolean,
    right: number,
    into: RaggedReport,
  ) => {
    const reaches = reachesEnd(line, right)
    if (reaches === null) return
    const ragged = reaches ? 0 : 1
    if (isLast || line.dataset.linebreakLine === "forced") {
      into.flush += 1
      into.raggedFlush += ragged
      return
    }
    into.stretched += 1
    into.raggedStretched += ragged
  }

  const report: RaggedReport = {
    flush: 0,
    raggedFlush: 0,
    stretched: 0,
    raggedStretched: 0,
  }
  for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
    const lines = [
      ...block.querySelectorAll<HTMLElement>(":scope > [data-linebreak-line]"),
    ]
    const right = rightOf(block)
    for (const [index, line] of lines.entries()) {
      tallyLine(line, index === lines.length - 1, right, report)
    }
  }
  return report
}

test("a line that ends a run of text stays ragged", async ({ page }) => {
  await settleTypeset(page)

  const ragged = await page.evaluate(raggedReport)

  expect(ragged.stretched).toBeGreaterThan(50)
  expect(ragged.raggedStretched).toBe(0)

  expect(ragged.flush).toBeGreaterThan(50)
  expect(ragged.raggedFlush / ragged.flush).toBeGreaterThan(0.9)
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
  expect(report.unhungOverflowBlocks).toBe(0)
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

test("removing a typeset block leaves the others typeset", async ({ page }) => {
  await settleTypeset(page)

  const restores = await page.evaluate(async () => {
    let count = 0
    new MutationObserver((records) => {
      for (const { target } of records) {
        if (!(target as Element).hasAttribute("data-linebreak-typeset")) {
          count += 1
        }
      }
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-linebreak-typeset"],
      subtree: true,
    })
    document.querySelector("[data-linebreak-typeset]")?.remove()
    await new Promise((resolve) => setTimeout(resolve, 500))
    return count
  })

  expect(restores).toBe(0)
})

test("scrolling back to a typeset block does not rewrite it", async ({
  page,
}) => {
  await settleTypeset(page)

  await page.evaluate(() => {
    const watched = [
      ...document.querySelectorAll("[data-linebreak-typeset]"),
    ].filter((block) => block.getBoundingClientRect().top < innerHeight)
    const state = { watched: watched.length, mutations: 0 }
    ;(window as { __rewrites?: typeof state }).__rewrites = state
    const observer = new MutationObserver((records) => {
      state.mutations += records.length
    })
    for (const block of watched) {
      observer.observe(block, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }
  })
  await sweepViewport(page)

  const rewrites = await page.evaluate(
    () =>
      (window as { __rewrites?: { watched: number; mutations: number } })
        .__rewrites,
  )
  expect(rewrites?.watched).toBeGreaterThan(0)
  expect(rewrites?.mutations).toBe(0)
})

test("a block edited while typeset is set again when it scrolls back", async ({
  page,
}) => {
  await settleTypeset(page)

  const edited =
    "Rewritten by the consumer after the paragraph was typeset, long enough to wrap across several lines of the measure so that it has to be broken into lines again by the typesetter."
  const marked = await page.evaluate((text) => {
    const block = [
      ...document.querySelectorAll<HTMLElement>("[data-linebreak-typeset]"),
    ].find((candidate) => candidate.getBoundingClientRect().top < innerHeight)
    if (!block) return false
    block.dataset.edited = ""
    block.textContent = text
    return true
  }, edited)
  expect(marked).toBe(true)

  await sweepViewport(page)

  const block = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>("[data-edited]")
    return {
      typeset: element?.hasAttribute("data-linebreak-typeset") ?? false,
      lines: element?.querySelectorAll(":scope > [data-linebreak-line]").length,
      letters: (element?.textContent ?? "").replace(/\s+/gu, ""),
    }
  })
  expect(block.typeset).toBe(true)
  expect(block.lines).toBeGreaterThan(1)
  expect(block.letters).toBe(edited.replace(/\s+/gu, ""))
})

test("hiding and showing a block keeps every block typeset", async ({
  page,
}) => {
  await settleTypeset(page)

  const result = await page.evaluate(async () => {
    let count = 0
    new MutationObserver((records) => {
      for (const { target } of records) {
        if (!(target as Element).hasAttribute("data-linebreak-typeset")) {
          count += 1
        }
      }
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-linebreak-typeset"],
      subtree: true,
    })
    const block = document.querySelector<HTMLElement>(
      "[data-linebreak-typeset]",
    )
    if (!block) return null
    block.style.display = "none"
    await new Promise((resolve) => setTimeout(resolve, 300))
    block.style.display = ""
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      restores: count,
      stillTypeset: block.hasAttribute("data-linebreak-typeset"),
    }
  })

  expect(result).toEqual({ restores: 0, stillTypeset: true })
})
