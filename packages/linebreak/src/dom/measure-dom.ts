import {
  createFontMetrics,
  type FontMetrics,
  type WidthSource,
} from "../text/measure"
import { type ProbeStyle, probeStyle, usesVariant } from "./style"

const HOST_STYLE =
  "position:absolute;left:-100000px;top:0;visibility:hidden;" +
  "pointer-events:none;white-space:pre;width:max-content;" +
  "contain:layout style paint"

const PROBE_STYLE = "display:block;width:max-content;white-space:pre"

export const domWidths = (
  document: Document,
  font: string,
  letterSpacing: number,
  style: ProbeStyle,
): WidthSource | null => {
  const root = document.body ?? document.documentElement
  if (!root) return null

  const widths = new Map<string, number>()

  const probeFor = (text: string) => {
    const probe = document.createElement("span")
    probe.style.cssText = PROBE_STYLE
    probe.style.font = font
    probe.style.letterSpacing = `${letterSpacing}px`
    for (const [property, value] of style) probe.style[property] = value
    probe.textContent = text
    return probe
  }

  const uncached = (texts: readonly string[]) => {
    const pending: string[] = []
    for (const text of new Set(texts)) {
      if (text.length > 0 && !widths.has(text)) pending.push(text)
    }
    return pending
  }

  const warm = (texts: readonly string[]) => {
    const pending = uncached(texts)
    if (pending.length === 0) return

    const host = document.createElement("div")
    host.setAttribute("aria-hidden", "true")
    host.style.cssText = HOST_STYLE
    const probes = pending.map(probeFor)
    for (const probe of probes) host.append(probe)

    root.append(host)
    for (const [index, probe] of probes.entries()) {
      widths.set(pending[index] as string, probe.getBoundingClientRect().width)
    }
    host.remove()
  }

  return {
    warm,
    advance(text) {
      const cached = widths.get(text)
      if (cached !== undefined) return cached
      warm([text])
      return widths.get(text) ?? 0
    },
  }
}

export const metricsForStyle = (
  document: Document,
  style: CSSStyleDeclaration,
  font: string,
  letterSpacing: number,
): FontMetrics | null => {
  if (!usesVariant(style)) return createFontMetrics(font, letterSpacing)
  const source = domWidths(document, font, letterSpacing, probeStyle(style))
  return source ? createFontMetrics(font, letterSpacing, source) : null
}
