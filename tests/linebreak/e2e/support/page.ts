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

export const honoursHangingMargins = (page: Page) =>
  page.evaluate(() => {
    const HANG = 16
    const host = document.createElement("div")
    host.style.cssText =
      "position:absolute;top:-9999px;left:0;visibility:hidden;contain:layout style"
    const block = document.createElement("div")
    block.style.cssText =
      "width:200px;text-align:justify;text-align-last:start;font:16px/1 monospace"
    const line = document.createElement("span")
    line.style.cssText = "display:inline;white-space:nowrap"
    line.textContent = "aaa bbb ccc ddd"
    const rest = document.createElement("span")
    rest.style.cssText = "display:inline;white-space:nowrap"
    rest.textContent = "eeeeeeeeeeeeeeeeeeeeeeee"

    block.append(line, document.createTextNode(" "), rest)
    host.append(block)
    document.body.append(host)

    line.style.marginInlineEnd = `${-HANG}px`
    const reach =
      line.getBoundingClientRect().right - block.getBoundingClientRect().right
    host.remove()
    return reach >= HANG - 0.5
  })

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
  unhungOverflowBlocks: number
  worstUnhungOverflowPx: number

  wrappedBlocks: number
  hyphenLines: number
  hangingLines: number
  liveText: string
}

const lineReport = (): LineReport => {
  type Tally = {
    lines: number
    justified: number
    short: number
    worstGap: number
    overflowing: number
    unhungOverflow: number
    worstUnhung: number
    wrapped: number
    hanging: number
  }

  const linesOf = (block: Element) => [
    ...block.querySelectorAll<HTMLElement>(":scope > [data-linebreak-line]"),
  ]

  const wrapsNatively = (block: Element, lines: number) => {
    const style = getComputedStyle(block)
    const content =
      block.clientHeight -
      Number.parseFloat(style.paddingTop) -
      Number.parseFloat(style.paddingBottom)
    return content > (lines + 0.5) * Number.parseFloat(style.lineHeight)
  }

  const hangsOf = (lines: readonly HTMLElement[]) => {
    let widest = 0
    let hanging = 0
    for (const line of lines) {
      const own = line.style
      if (own.marginInlineStart || own.marginInlineEnd) hanging += 1
      widest = Math.max(widest, -Number.parseFloat(own.marginInlineEnd || "0"))
    }
    return { widest, hanging }
  }

  const overflowOf = (block: Element, hang: number) => {
    const overflow = block.scrollWidth - block.clientWidth
    if (overflow <= 1) return { overflowing: 0, unhung: 0, worst: 0 }
    if (overflow <= 1 + hang) return { overflowing: 1, unhung: 0, worst: 0 }
    return { overflowing: 1, unhung: 1, worst: overflow - hang }
  }

  const shortfallOf = (line: Element) => {
    const range = document.createRange()
    range.selectNodeContents(line)
    const gap =
      line.getBoundingClientRect().width - range.getBoundingClientRect().width
    const allowed = line.matches('[data-linebreak-line="hyphen"]') ? 12 : 1.5
    return gap <= allowed ? null : gap
  }

  const gapsOf = (lines: readonly HTMLElement[]) => {
    let justified = 0
    let short = 0
    let worstGap = 0
    for (const line of lines.slice(0, -1)) {
      const gap = shortfallOf(line)
      if (gap === null) justified += 1
      else {
        short += 1
        worstGap = Math.max(worstGap, gap)
      }
    }
    return { justified, short, worstGap }
  }

  const tallyOf = (block: Element): Tally => {
    const lines = linesOf(block)
    const hangs = hangsOf(lines)
    const overflow = overflowOf(block, hangs.widest)
    const gaps = gapsOf(lines)
    return {
      lines: lines.length,
      justified: gaps.justified,
      short: gaps.short,
      worstGap: gaps.worstGap,
      overflowing: overflow.overflowing,
      unhungOverflow: overflow.unhung,
      worstUnhung: overflow.worst,
      wrapped: wrapsNatively(block, lines.length) ? 1 : 0,
      hanging: hangs.hanging,
    }
  }

  const blocks = [...document.querySelectorAll("[data-linebreak-typeset]")]
  const total: Tally = {
    lines: 0,
    justified: 0,
    short: 0,
    worstGap: 0,
    overflowing: 0,
    unhungOverflow: 0,
    worstUnhung: 0,
    wrapped: 0,
    hanging: 0,
  }

  for (const block of blocks) {
    const tally = tallyOf(block)
    total.lines += tally.lines
    total.justified += tally.justified
    total.short += tally.short
    total.worstGap = Math.max(total.worstGap, tally.worstGap)
    total.overflowing += tally.overflowing
    total.unhungOverflow += tally.unhungOverflow
    total.worstUnhung = Math.max(total.worstUnhung, tally.worstUnhung)
    total.wrapped += tally.wrapped
    total.hanging += tally.hanging
  }

  return {
    typesetBlocks: blocks.length,
    totalLines: total.lines,
    justifiedLines: total.justified,
    shortLines: total.short,
    worstGapPx: Math.round(total.worstGap * 10) / 10,
    overflowingBlocks: total.overflowing,
    unhungOverflowBlocks: total.unhungOverflow,
    worstUnhungOverflowPx: Math.round(total.worstUnhung * 10) / 10,
    wrappedBlocks: total.wrapped,
    hangingLines: total.hanging,
    hyphenLines: document.querySelectorAll('[data-linebreak-line="hyphen"]')
      .length,
    liveText:
      document.querySelector("main")?.innerText.replace(/\s+/gu, " ").trim() ??
      "",
  }
}

export const measureLines = (page: Page) =>
  page.evaluate<LineReport>(lineReport)
