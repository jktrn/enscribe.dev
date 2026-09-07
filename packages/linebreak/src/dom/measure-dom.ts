import { createFontMetrics, createPlainFontMetrics, preparedRunWidth, type WidthSource } from "../text/measure"
import type { Advance, FontMetrics } from "../text/segments"
import { cachedNativeAdvance, cachedNativeCalibration, hasNativeCalibration, sharedDomWidths } from "../text/native-width-cache"
import { offscreen } from "./probe"
import { computedFont, cssPixels, type ProbeStyle, probeStyle, usesVariant, variantKey } from "./style"

const PROBE_LINE = "display:block;width:max-content;white-space:pre"
const FONT_SAMPLES = ["AVATARoffice0123456789", "🙂"]
const ASCII_FONT_SAMPLES = [FONT_SAMPLES[0]!]
const WIDTH_EPSILON = 0.02
type DomWidths = WidthSource & {
  append(host: HTMLElement, texts: readonly string[]): () => void
}

const domWidths = (
  document: Document,
  font: string,
  letterSpacing: number,
  style: ProbeStyle,
  fontKey: string,
): DomWidths | null => {
  if (!(document.body ?? document.documentElement)) return null

  const widths = new Map<string, number>([["", 0]])
  const shared = sharedDomWidths(document, `${fontKey}|${letterSpacing}`)

  const probeFor = (text: string) => {
    const probe = document.createElement("span")
    probe.style.cssText = PROBE_LINE
    probe.style.font = font
    probe.style.letterSpacing = `${letterSpacing}px`
    for (const [property, value] of style) probe.style[property] = value
    probe.textContent = text
    return probe
  }

  const uncached = (texts: readonly string[]) => {
    const pending: string[] = []
    for (const text of new Set(texts)) {
      if (widths.has(text)) continue
      const saved = shared?.get(text)
      if (saved !== undefined) widths.set(text, saved)
      else pending.push(text)
    }
    return pending
  }

  const appendPending = (host: HTMLElement, pending: readonly string[]) => {
    const probes = pending.map(probeFor)
    for (const probe of probes) host.append(probe)
    return () => {
      for (const [index, probe] of probes.entries()) {
        const text = pending[index] as string, width = probe.getBoundingClientRect().width
        widths.set(text, width)
        shared?.set(text, width)
      }
    }
  }

  const warm = (texts: readonly string[]) => {
    const pending = uncached(texts)
    if (pending.length > 0) offscreen(document, host => appendPending(host, pending)())
  }

  return {
    append: (host, texts) => appendPending(host, uncached(texts)),
    warm,
    advance(text) {
      const cached = widths.get(text)
      if (cached !== undefined) return cached
      warm([text])
      return widths.get(text) ?? 0
    },
  }
}

const advanceFrom = (
  context: Pick<CanvasRenderingContext2D, "font" | "measureText"> | null,
  font: string,
): Advance | null => {
  if (!context) return null
  context.font = font
  return (text) => context.measureText(text).width
}

const canvasContext = (document: Document, host: HTMLElement) => {
  const canvas = document.createElement("canvas")
  host.append(canvas)
  return canvas.getContext("2d")
}

const witnessContexts = new WeakMap<Document, CanvasRenderingContext2D>()

export const currentAdvance = (
  document: Document,
  font: string,
  text: string,
): number | null => {
  let context = witnessContexts.get(document)
  if (!context) {
    const created = offscreen(document, host => {
      const canvas = document.createElement("canvas")
      host.append(canvas)
      return canvas.getContext("2d")
    })
    if (!created) return null
    context = created
    witnessContexts.set(document, context)
  }
  context.font = font
  return context.measureText(text).width
}

const nativeContext = (document: Document) => {
  const Canvas = document.defaultView?.OffscreenCanvas
  if (!Canvas) {
    return offscreen(document, (host) => canvasContext(document, host))
  }
  return new Canvas(1, 1).getContext("2d")
}

const nativeRun = (document: Document, font: string): Advance | null =>
  advanceFrom(nativeContext(document), font)

const nativeMatchesRendered = (native: Advance, source: WidthSource, samples: readonly string[]) => {
  source.warm(samples)
  // Reject an incompatible native provider before initializing text analysis.
  // In particular, bitmap emoji can fail even when ordinary glyphs agree.
  return samples.every(sample => Math.abs(native(sample) - source.advance(sample)) <= WIDTH_EPSILON)
}

const calibratedMetrics = (document: Document, font: string, fontKey: string, native: Advance, source: WidthSource) => {
  if (!cachedNativeCalibration(document, fontKey, () => nativeMatchesRendered(native, source, ASCII_FONT_SAMPLES)))
    return createFontMetrics(font, 0, { paragraph: source })
  const cached = cachedNativeAdvance(document, fontKey, native)
  return createPlainFontMetrics(font, cached, () => {
    const compatible = cachedNativeCalibration(document, `${fontKey}\0general`, () => nativeMatchesRendered(native, source, FONT_SAMPLES))
    source.warm(FONT_SAMPLES)
    const matches = compatible && FONT_SAMPLES.every(sample => Math.abs(preparedRunWidth(sample, font, 0) - source.advance(sample)) <= WIDTH_EPSILON)
    return createFontMetrics(font, 0, matches ? { run: native } : { paragraph: source })
  }, () => cachedNativeCalibration(document, `${fontKey}\0punctuation`, () =>
    nativeMatchesRendered(native, source, ["“”‘’—"]))
    ? { advance: cached, warm() {} } : null)
}

/** Batch a document's first font probes and retain the providers they validate. */
export const primeFontMetrics = (document: Document, styles: () => Iterable<CSSStyleDeclaration>) => {
  if (document.fonts?.status !== "loaded" || hasNativeCalibration(document)) return []
  const requests = new Map<string, { font: string; style: CSSStyleDeclaration; variant: string }>()
  for (const style of styles()) {
    if (cssPixels(style.letterSpacing) !== 0 || usesVariant(style)) continue
    const font = computedFont(style), variant = variantKey(style)
    requests.set(`${font}|${variant}`, { font, style, variant })
  }
  if (requests.size < 2) return []
  const context = nativeContext(document)
  if (!context) return []
  let activeFont = ""
  const pending = [...requests].flatMap(([key, { font, style, variant }]) => {
    const native: Advance = text => {
      if (activeFont !== font) { context.font = font; activeFont = font }
      return context.measureText(text).width
    }
    const source = domWidths(document, font, 0, probeStyle(style), key)
    return source ? [{ key, suffix: `0|${variant}|${font}`, font, native, source }] : []
  })
  offscreen(document, host => {
    const read = pending.map(request => request.source.append(host, ASCII_FONT_SAMPLES))
    for (const measure of read) measure()
  })
  return pending.map(({ key, suffix, font, native, source }) => ({
    suffix, metrics: calibratedMetrics(document, font, key, native, source),
  }))
}

export const metricsForStyle = (
  document: Document,
  style: CSSStyleDeclaration,
  font: string,
  letterSpacing: number,
): FontMetrics | null => {
  const fontKey = `${font}|${variantKey(style)}`
  const source = domWidths(document, font, letterSpacing, probeStyle(style), fontKey)
  if (letterSpacing === 0 && !usesVariant(style)) {
    const native = nativeRun(document, font)
    if (!native) return createFontMetrics(font, letterSpacing)
    // Canvas font resolution and bitmap emoji metrics can differ from DOM.
    // Calibrate both width providers before trusting the faster run path.
    if (source) return calibratedMetrics(document, font, fontKey, native, source)
  }
  return source
    ? createFontMetrics(font, letterSpacing, { paragraph: source })
    : null
}
