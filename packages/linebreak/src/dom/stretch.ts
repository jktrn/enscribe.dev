import { calibrateStretch, type StretchScale } from "../text/stretch"

const PROBE_STYLE =
  "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre"

const PROBE_TEXT =
  "Hamburgefonstiv the quick brown fox jumps over a lazy dog, 0123456789"

let scales = new WeakMap<Document, Map<string, StretchScale | null>>()

export const invalidateStretchScales = () => {
  scales = new WeakMap()
}

const measured = (
  document: Document,
  font: string,
  letterSpacing: number,
  budget: number,
): StretchScale | null => {
  const host = document.body ?? document.documentElement
  if (!host) return null

  const probe = document.createElement("span")
  probe.setAttribute("aria-hidden", "true")
  probe.style.cssText = PROBE_STYLE
  probe.style.font = font
  probe.style.letterSpacing = `${letterSpacing}px`
  probe.textContent = PROBE_TEXT
  host.appendChild(probe)

  const scale = calibrateStretch(budget, (pct) => {
    probe.style.fontStretch = `${pct}%`
    return probe.getBoundingClientRect().width
  })
  probe.remove()
  return scale
}

export const stretchScaleFor = (
  document: Document,
  font: string,
  letterSpacing: number,
  budget: number,
): StretchScale | null => {
  let byFont = scales.get(document)
  if (!byFont) {
    byFont = new Map()
    scales.set(document, byFont)
  }

  const key = `${letterSpacing}|${font}`
  const cached = byFont.get(key)
  if (cached !== undefined) return cached

  const scale = measured(document, font, letterSpacing, budget)
  byFont.set(key, scale)
  return scale
}
