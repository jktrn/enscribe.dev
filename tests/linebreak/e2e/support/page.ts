import type { Page } from "@playwright/test"

export const ARTICLE = "/blog/japan-retrospective"

export const sweepViewport = async (page: Page) => {
  await page.evaluate(async () => {
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

export const waitForQuiet = async (page: Page, settleMs = 500) => {
  await page
    .waitForFunction(
      (quietMs) => {
        const lines = document.querySelectorAll(
          "[data-linebreak-typeset] > [data-linebreak-line]",
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
    .catch(() => {})
}

export const settleTypeset = async (page: Page, path = ARTICLE) => {
  await page.goto(path, { waitUntil: "load" })
  await page.evaluate(() => document.fonts.ready)
  await sweepViewport(page)
}

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

  justifiedLines: number
  shortLines: number
  worstGapPx: number
  overflowingBlocks: number

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
      const lines = [
        ...block.querySelectorAll(":scope > [data-linebreak-line]"),
      ]
      totalLines += lines.length
      const style = getComputedStyle(block)
      const lineHeight = Number.parseFloat(style.lineHeight)

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

        const allowed = line.matches('[data-linebreak-line="hyphen"]')
          ? 12
          : 1.5
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
      hyphenLines: document.querySelectorAll('[data-linebreak-line="hyphen"]')
        .length,
      liveText:
        document
          .querySelector("main")
          ?.innerText.replace(/\s+/gu, " ")
          .trim() ?? "",
    }
  })
