import { expect, test } from "@playwright/test"
import {
  honoursHangingMargins,
  measureLines,
  settleTypeset,
  sweepViewport,
} from "../support/page"
import { PROTRUSION } from "../support/protrusion"

test.use({ viewport: { width: 1440, height: 900 } })

type EdgeReport = {
  hung: number
  checkedStarts: number
  checkedEnds: number
  worstStart: number
  worstEnd: number
  maxHang: number
}

const edgeReport = (codes: typeof PROTRUSION): EdgeReport => {
  const context = document.createElement("canvas").getContext("2d")
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

  const insetOf = (block: Element) => {
    const style = getComputedStyle(block)
    const box = block.getBoundingClientRect()
    return {
      left:
        box.left +
        Number.parseFloat(style.paddingInlineStart || "0") +
        Number.parseFloat(style.borderInlineStartWidth || "0"),
      right:
        box.right -
        Number.parseFloat(style.paddingInlineEnd || "0") -
        Number.parseFloat(style.borderInlineEndWidth || "0"),
    }
  }

  const hangerOf = (block: Element) => {
    const style = getComputedStyle(block)
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const spacing = Number.parseFloat(style.letterSpacing) || 0
    return (character: string, side: "l" | "r") => {
      const code = codes[character]?.[side] ?? 0
      if (code === 0 || character === "") return 0
      return (code / 1000) * (context.measureText(character).width + spacing)
    }
  }

  type Hang = ReturnType<typeof hangerOf>

  const wantsOf = (line: HTMLElement, hangOf: Hang) => {
    const text = (line.textContent ?? "").trim()
    const start = hangOf(first(text), "l")
    if (line.dataset.linebreakLine === "hyphen")
      return { start, end: hangOf("-", "r") }
    return { start, end: hangOf(last(text), "r") }
  }

  const marginsOf = (line: HTMLElement) => {
    const own = line.style
    const start = -Number.parseFloat(own.marginInlineStart || "0")
    const end = -Number.parseFloat(own.marginInlineEnd || "0")
    if (!own.marginInlineStart && !own.marginInlineEnd) {
      return { hung: 0, widest: 0 }
    }
    return { hung: 1, widest: Math.max(start, end) }
  }

  const startEdge = (rects: DOMRect[], left: number, want: number) => {
    if (want <= 0 || rects.length !== 1) return { checked: 0, worst: 0 }
    const rect = rects[0] as DOMRect
    return { checked: 1, worst: Math.abs(rect.left - (left - want)) }
  }

  const endEdge = (
    rects: DOMRect[],
    right: number,
    want: number,
    ragged: boolean,
  ) => {
    if (ragged || want <= 0) return { checked: 0, worst: 0 }
    const rect = rects[0] as DOMRect
    return { checked: 1, worst: Math.abs(rect.right - (right + want)) }
  }

  const isRagged = (
    line: HTMLElement,
    index: number,
    lineCount: number,
    rectCount: number,
  ) =>
    index === lineCount - 1 ||
    line.dataset.linebreakLine === "forced" ||
    rectCount > 1

  const tallyBlock = (block: Element, into: EdgeReport) => {
    const lines = [
      ...block.querySelectorAll<HTMLElement>(":scope > [data-linebreak-line]"),
    ]
    const inset = insetOf(block)
    const hangOf = hangerOf(block)

    for (const [index, line] of lines.entries()) {
      const rects = [...line.getClientRects()]
      if (rects.length === 0) continue

      const margins = marginsOf(line)
      into.hung += margins.hung
      into.maxHang = Math.max(into.maxHang, margins.widest)

      const wants = wantsOf(line, hangOf)
      const ragged = isRagged(line, index, lines.length, rects.length)
      const start = startEdge(rects, inset.left, wants.start)
      const end = endEdge(rects, inset.right, wants.end, ragged)

      into.checkedStarts += start.checked
      into.worstStart = Math.max(into.worstStart, start.worst)
      into.checkedEnds += end.checked
      into.worstEnd = Math.max(into.worstEnd, end.worst)
    }
  }

  const report: EdgeReport = {
    hung: 0,
    checkedStarts: 0,
    checkedEnds: 0,
    worstStart: 0,
    worstEnd: 0,
    maxHang: 0,
  }
  for (const block of document.querySelectorAll("[data-linebreak-typeset]")) {
    tallyBlock(block, report)
  }
  return report
}

const edges = (
  page: import("@playwright/test").Page,
  table: typeof PROTRUSION,
) => page.evaluate(edgeReport, table)

test("punctuation hangs past the measure on both sides", async ({ page }) => {
  await settleTypeset(page)
  const report = await edges(page, PROTRUSION)

  if (!(await honoursHangingMargins(page))) {
    expect(report.hung).toBe(0)
    expect(report.maxHang).toBe(0)
    return
  }

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

  expect(report.unhungOverflowBlocks).toBe(0)
  expect(report.worstUnhungOverflowPx).toBe(0)
  expect(report.wrappedBlocks).toBe(0)

  if (!(await honoursHangingMargins(page))) {
    expect(report.hangingLines).toBe(0)
    return
  }

  expect(report.hangingLines).toBeGreaterThan(50)
  expect(report.overflowingBlocks).toBeGreaterThan(0)
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

const MONO_FIXTURE = () => {
  const SENTENCE =
    "The daemon reads its configuration once, caches it, and never looks " +
    "again; any edit to the file, however small, needs a restart. " +
    "“Never” is the operative word, and the path is fixed. "
  const TEXT = SENTENCE.repeat(4)
  const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace'

  const parent =
    document.querySelector("prose-content") ??
    document.querySelector("main p")?.parentElement
  if (!parent) throw new Error("no prose container to add a paragraph to")

  const add = (id: string, font: string, inset: boolean) => {
    const block = document.createElement("p")
    block.id = id
    block.style.textAlign = "justify"
    if (font && !inset) block.style.fontFamily = font
    if (inset) {
      const run = document.createElement("span")
      run.style.fontFamily = font
      run.textContent = TEXT
      block.append(run)
    } else {
      block.textContent = TEXT
    }
    parent.append(block)
  }

  add("lb-prose-control", "", false)
  add("lb-mono-block", MONO, false)
  add("lb-mono-inset", MONO, true)

  for (const enabled of [false, true]) {
    document.dispatchEvent(
      new CustomEvent("text-justification-change", { detail: { enabled } }),
    )
  }
}

test("a monospace run inside prose does not hang into the margin", async ({
  page,
}) => {
  await settleTypeset(page)
  await page.evaluate(MONO_FIXTURE)
  await sweepViewport(page)
  await page.waitForFunction(() =>
    document
      .getElementById("lb-mono-inset")
      ?.hasAttribute("data-linebreak-typeset"),
  )

  const report = await page.evaluate(() =>
    ["lb-prose-control", "lb-mono-block", "lb-mono-inset"].map((id) => {
      const block = document.getElementById(id) as HTMLElement
      const lines = [
        ...block.querySelectorAll<HTMLElement>(
          ":scope > [data-linebreak-line]",
        ),
      ]
      return {
        id,
        typeset: block.hasAttribute("data-linebreak-typeset"),
        lines: lines.length,
        hung: lines.filter(
          (line) => line.style.marginInlineStart || line.style.marginInlineEnd,
        ).length,
      }
    }),
  )

  const [control, monoBlock, monoInset] = report
  const hangs = await honoursHangingMargins(page)

  expect(control?.typeset).toBe(true)
  expect(control?.lines).toBeGreaterThan(2)

  expect(monoBlock?.typeset).toBe(true)
  expect(monoBlock?.lines).toBeGreaterThan(2)

  expect(monoInset?.typeset).toBe(true)
  expect(monoInset?.lines).toBeGreaterThan(2)
  expect(monoInset?.hung).toBe(0)

  if (!hangs) {
    expect(control?.hung).toBe(0)
    expect(monoBlock?.hung).toBe(0)
    return
  }
  expect(control?.hung).toBeGreaterThan(0)
  expect(monoBlock?.hung).toBeGreaterThan(0)
})
