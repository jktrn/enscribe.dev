import { GLUE } from "./engines"
import type { EngineId } from "./state"

export type Gap = {
  readonly left: number
  readonly right: number
  readonly width: number
  readonly top: number
  readonly bottom: number
  readonly natural: number
}

export type LineGeometry = {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly allowance: number
  readonly gaps: Gap[]
  readonly ratio: number
  readonly badness: number
  readonly last: boolean
}

export type ParagraphGeometry = {
  readonly element: HTMLElement
  readonly lines: LineGeometry[]
  readonly splitWords: number
  readonly left: number
  readonly right: number
}

export type ColumnMetrics = {
  readonly paragraphs: ParagraphGeometry[]
  readonly lines: number
  readonly hyphens: number
  readonly overfull: number
  readonly shortLast: number
  readonly meanSpace: number
  readonly deviation: number
  readonly sigma: number
  readonly loosest: number
  readonly tightest: number
  readonly totalBadness: number
  readonly worstBadness: number
}

type Box = {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly natural: number
  readonly element: HTMLElement
}

const INF_BAD = 10_000
const LINE_EPSILON = 6
const GAP_EPSILON = 1
const OVERFULL_SLACK = 2

const range = document.createRange()
const naturals = new Map<string, number>()

const naturalSpaceOf = (element: HTMLElement) => {
  const style = getComputedStyle(element)
  const key = `${style.fontStyle}|${style.fontWeight}|${style.fontSize}|${style.fontFamily}`
  const cached = naturals.get(key)
  if (cached !== undefined) return cached

  const probe = document.createElement("span")
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;top:-9999px"
  probe.style.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  probe.textContent = "x x"
  document.body.append(probe)
  const node = probe.firstChild as Text
  range.setStart(node, 1)
  range.setEnd(node, 2)
  const width = range.getBoundingClientRect().width
  probe.remove()

  naturals.set(key, width)
  return width
}

const wordBoxes = (paragraph: HTMLElement) => {
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  const boxes: Box[] = []
  let splitWords = 0

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? ""
    const host = (node.parentElement ?? paragraph) as HTMLElement
    const natural = naturalSpaceOf(host)
    for (const match of text.matchAll(/\S+/gu)) {
      const start = match.index
      range.setStart(node, start)
      range.setEnd(node, start + match[0].length)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0)
      if (rects.length > 1) splitWords += 1
      for (const rect of rects) {
        boxes.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          natural,
          element: host,
        })
      }
    }
  }
  return { boxes, splitWords }
}

const clusterLines = (boxes: Box[]) => {
  boxes.sort((a, b) => a.top - b.top || a.left - b.left)
  const rows: Box[][] = []
  let reference = Number.NaN
  for (const box of boxes) {
    const row = rows.at(-1)
    if (row && box.top - reference < LINE_EPSILON) row.push(box)
    else {
      rows.push([box])
      reference = box.top
    }
  }
  for (const row of rows) row.sort((a, b) => a.left - b.left)
  return rows
}

const gapsOf = (row: Box[]) => {
  const gaps: Gap[] = []
  for (let index = 1; index < row.length; index += 1) {
    const previous = row[index - 1] as Box
    const box = row[index] as Box
    const width = box.left - previous.right
    if (width <= GAP_EPSILON) continue
    gaps.push({
      left: previous.right,
      right: box.left,
      width,
      top: Math.min(previous.top, box.top),
      bottom: Math.max(previous.bottom, box.bottom),
      natural: Math.min(previous.natural, box.natural),
    })
  }
  return gaps
}

const ratioOf = (gaps: readonly Gap[]) => {
  if (gaps.length === 0) return Number.NaN
  let natural = 0
  let actual = 0
  for (const gap of gaps) {
    natural += gap.natural
    actual += gap.width
  }
  const slack = actual - natural
  const capacity = natural * (slack >= 0 ? GLUE.stretch : GLUE.shrink)
  return capacity === 0 ? Number.NaN : slack / capacity
}

const badnessOf = (ratio: number) =>
  Number.isFinite(ratio) ? Math.min(INF_BAD, 100 * Math.abs(ratio) ** 3) : 0

const hangAllowance = (box: Box, paragraph: HTMLElement) => {
  let allowance = 0
  for (
    let element: HTMLElement | null = box.element;
    element !== null && element !== paragraph;
    element = element.parentElement
  ) {
    const margin = Number.parseFloat(element.style.marginInlineEnd) || 0
    allowance += Math.max(0, -margin)
  }
  return allowance
}

const lineGeometry = (
  row: Box[],
  last: boolean,
  paragraph: HTMLElement,
): LineGeometry => {
  const gaps = gapsOf(row)
  const ratio = ratioOf(gaps)
  const first = row[0] as Box
  const final = row.at(-1) as Box
  return {
    top: Math.min(...row.map((box) => box.top)),
    bottom: Math.max(...row.map((box) => box.bottom)),
    left: first.left,
    right: final.right,
    allowance: hangAllowance(final, paragraph),
    gaps,
    ratio,
    badness: badnessOf(ratio),
    last,
  }
}

export const paragraphGeometry = (
  paragraph: HTMLElement,
): ParagraphGeometry => {
  const { boxes, splitWords } = wordBoxes(paragraph)
  const rows = clusterLines(boxes)
  const style = getComputedStyle(paragraph)
  const rect = paragraph.getBoundingClientRect()
  return {
    element: paragraph,
    lines: rows.map((row, index) =>
      lineGeometry(row, index === rows.length - 1, paragraph),
    ),
    splitWords,
    left: rect.left + (Number.parseFloat(style.paddingLeft) || 0),
    right: rect.right - (Number.parseFloat(style.paddingRight) || 0),
  }
}

const HYPHEN_SELECTOR: Record<EngineId, string> = {
  browser: "",
  linebreak: '[data-linebreak-line="hyphen"]',
  justif: ".justif-hyphen",
}

const hyphenCount = (
  article: HTMLElement,
  engine: EngineId,
  paragraphs: readonly ParagraphGeometry[],
) => {
  const selector = HYPHEN_SELECTOR[engine]
  if (selector === "") {
    return paragraphs.reduce((total, para) => total + para.splitWords, 0)
  }
  return article.querySelectorAll(selector).length
}

const overfullCount = (paragraphs: readonly ParagraphGeometry[]) => {
  let count = 0
  for (const para of paragraphs) {
    for (const line of para.lines) {
      if (line.right > para.right + line.allowance + OVERFULL_SLACK) count += 1
    }
  }
  return count
}

const shortLastCount = (paragraphs: readonly ParagraphGeometry[]) => {
  let count = 0
  for (const para of paragraphs) {
    const last = para.lines.at(-1)
    if (!last || para.lines.length < 2) continue
    if (last.right - last.left < (para.right - para.left) / 3) count += 1
  }
  return count
}

const spacingStats = (ratios: number[]) => {
  if (ratios.length === 0) {
    return { meanSpace: 1, deviation: 0, sigma: 0, loosest: 1, tightest: 1 }
  }
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
  const variance =
    ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length
  return {
    meanSpace: mean,
    deviation: ratios.reduce((a, b) => a + Math.abs(b - 1), 0) / ratios.length,
    sigma: Math.sqrt(variance),
    loosest: Math.max(...ratios),
    tightest: Math.min(...ratios),
  }
}

export const measureColumn = (
  article: HTMLElement,
  engine: EngineId,
): ColumnMetrics => {
  const paragraphs = [...article.querySelectorAll("p")].map(paragraphGeometry)
  const bodyLines = paragraphs.flatMap((para) =>
    para.lines.filter((line) => !line.last),
  )
  const ratios = bodyLines.flatMap((line) =>
    line.gaps.map((gap) => gap.width / gap.natural),
  )
  const badnesses = bodyLines
    .filter((line) => line.gaps.length > 0)
    .map((line) => line.badness)

  return {
    paragraphs,
    lines: paragraphs.reduce((total, para) => total + para.lines.length, 0),
    hyphens: hyphenCount(article, engine, paragraphs),
    overfull: overfullCount(paragraphs),
    shortLast: shortLastCount(paragraphs),
    ...spacingStats(ratios),
    totalBadness: badnesses.reduce((a, b) => a + b, 0),
    worstBadness: badnesses.length === 0 ? 0 : Math.max(...badnesses),
  }
}
