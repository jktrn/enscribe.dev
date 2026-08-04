import type { Line } from "../layout/breaker"
import { LINE_SELECTOR } from "./render"
import { cssPixels } from "./style"

export const viewOf = (element: HTMLElement) =>
  element.ownerDocument.defaultView ?? globalThis

export const styleOf = (element: HTMLElement) =>
  viewOf(element).getComputedStyle(element)

export const contentWidth = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
) =>
  element.clientWidth -
  cssPixels(style.paddingInlineStart) -
  cssPixels(style.paddingInlineEnd)

export const resolvedLineHeight = (style: CSSStyleDeclaration) => {
  const value = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(value)) return value
  const fontSize = Number.parseFloat(style.fontSize)
  return Number.isFinite(fontSize) ? fontSize * 1.2 : Number.NaN
}

export const hangSlack = (lines: readonly Line[]) => {
  let most = 0
  for (const line of lines) {
    if (line.hangEnd > most) most = line.hangEnd
  }
  return most
}

export const layoutMismatch = (
  element: HTMLElement,
  lineCount: number,
  slack: number,
) => {
  const segments = element.querySelectorAll<HTMLElement>(LINE_SELECTOR)
  if (segments.length !== lineCount) return true

  const rows = new Set<number>()
  for (const segment of segments) {
    const rect = segment.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    rows.add(Math.round(rect.top))
  }
  if (rows.size !== lineCount) return true

  return element.scrollWidth > element.clientWidth + 1 + slack
}
