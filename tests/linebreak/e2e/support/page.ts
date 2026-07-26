import type { Page } from "@playwright/test"

/** A long, markup-heavy article: code spans, favicon links, images, footnotes. */
export const ARTICLE = "/blog/japan-retrospective"

/**
 * Loads a page and lets the typesetter reach every block.
 *
 * Blocks are typeset as they approach the viewport, so a full scroll is what
 * queues the whole document. Without it a spec only ever sees the first screen.
 */
export const sweepViewport = async (page: Page) => {
  await page.evaluate(async () => {
    // Bounded: the article is long enough that an unbounded per-viewport walk
    // outlives the default action timeout.
    const steps = Math.min(
      60,
      Math.ceil(document.body.scrollHeight / innerHeight),
    )
    const stride = document.body.scrollHeight / steps
    for (let step = 0; step <= steps; step += 1) {
      scrollTo(0, step * stride)
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    scrollTo(0, 0)
  })
  await waitForQuiet(page)
}

/**
 * Waits until typesetting stops changing the page.
 *
 * Blocks are typeset in idle time, so how long that takes depends on what else
 * the machine is doing — three browser projects in parallel is enough to push it
 * past any fixed delay. Waiting on the work itself rather than on a duration is
 * what keeps these specs from failing on a busy machine and, worse, passing on a
 * quiet one while asserting against a half-typeset page.
 */
export const waitForQuiet = async (page: Page, settleMs = 500) => {
  await page
    .waitForFunction(
      (quietMs) => {
        const lines = document.querySelectorAll(
          "[data-linebreak-typeset] > .lb-line",
        ).length
        const state = (
          window as { __lbQuiet?: { lines: number; since: number } }
        ).__lbQuiet
        const now = performance.now()
        if (!state || state.lines !== lines) {
          ;(window as { __lbQuiet?: unknown }).__lbQuiet = { lines, since: now }
          return false
        }
        return lines > 0 && now - state.since >= quietMs
      },
      settleMs,
      { timeout: 20_000, polling: 100 },
    )
    .catch(() => {
      // A page with no prose at all never reports lines; the specs that use one
      // assert on its emptiness themselves.
    })
}

export const settleTypeset = async (page: Page, path = ARTICLE) => {
  await page.goto(path, { waitUntil: "load" })
  await page.evaluate(() => document.fonts.ready)
  await sweepViewport(page)
}

/** The same URL rendered with JavaScript disabled — the correctness baseline. */
export const nativeText = async (page: Page, path = ARTICLE) => {
  const context = await page
    .context()
    .browser()
    ?.newContext({
      javaScriptEnabled: false,
      viewport: page.viewportSize() ?? { width: 1440, height: 900 },
    })
  if (!context) throw new Error("could not open a JavaScript-disabled context")
  const plain = await context.newPage()
  await plain.goto(path, { waitUntil: "load" })
  const text = await plain.evaluate(
    () =>
      document.querySelector("main")?.innerText.replace(/\s+/gu, " ").trim() ??
      "",
  )
  await context.close()
  return text
}

export type LineReport = {
  typesetBlocks: number
  totalLines: number
  /** Non-final lines reaching the container's inline end within tolerance. */
  justifiedLines: number
  shortLines: number
  worstGapPx: number
  overflowingBlocks: number
  /** Blocks taller than their line count — a line the browser wrapped. */
  wrappedBlocks: number
  hyphenLines: number
  liveText: string
}

export const measureLines = (page: Page) =>
  page.evaluate<LineReport>(() => {
    const blocks = [...document.querySelectorAll("[data-linebreak-typeset]")]
    let totalLines = 0
    let justifiedLines = 0
    let shortLines = 0
    let worstGapPx = 0
    let overflowingBlocks = 0
    let wrappedBlocks = 0

    for (const block of blocks) {
      const lines = [...block.querySelectorAll(":scope > .lb-line")]
      totalLines += lines.length
      const style = getComputedStyle(block)
      const lineHeight = Number.parseFloat(style.lineHeight)
      // Lines are text rows, so the height they are compared against has to
      // exclude the block's own padding.
      const contentHeight =
        block.clientHeight -
        Number.parseFloat(style.paddingTop) -
        Number.parseFloat(style.paddingBottom)
      if (contentHeight > (lines.length + 0.5) * lineHeight) {
        wrappedBlocks += 1
      }
      if (block.scrollWidth > block.clientWidth + 1) overflowingBlocks += 1

      for (const line of lines.slice(0, -1)) {
        const range = document.createRange()
        range.selectNodeContents(line)
        const gap =
          line.getBoundingClientRect().width -
          range.getBoundingClientRect().width
        // A Range measures real nodes only, so it cannot see the hyphen drawn
        // as generated content at a hyphenated break. That hyphen genuinely
        // occupies the remaining space, so allow its advance on those lines.
        const allowed = line.classList.contains("lb-hyphen") ? 12 : 1.5
        if (gap <= allowed) justifiedLines += 1
        else {
          shortLines += 1
          worstGapPx = Math.max(worstGapPx, gap)
        }
      }
    }

    return {
      typesetBlocks: blocks.length,
      totalLines,
      justifiedLines,
      shortLines,
      worstGapPx: Math.round(worstGapPx * 10) / 10,
      overflowingBlocks,
      wrappedBlocks,
      hyphenLines: document.querySelectorAll(".lb-hyphen").length,
      liveText:
        document
          .querySelector("main")
          ?.innerText.replace(/\s+/gu, " ")
          .trim() ?? "",
    }
  })
