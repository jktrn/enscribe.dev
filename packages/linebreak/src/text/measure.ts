import { clearCache, prepareWithSegments, setLocale } from "@chenglou/pretext"
import type { Advance, FontMetrics, MeasuredSegment, SegmentKind } from "./segments"
import { plainParts, hyphenatedParts, punctuationParts } from "./plain-segments"
import { invalidateNativeWidths } from "./native-width-cache"

type PretextView = {
  readonly segments: readonly string[]
  readonly widths: readonly number[]
  readonly kinds: readonly string[]
}

const prepare = (text: string, font: string, letterSpacing: number): PretextView =>
  prepareWithSegments(text, font, { letterSpacing, whiteSpace: "pre-wrap" })

export const preparedRunWidth = (
  text: string,
  font: string,
  letterSpacing: number,
): number => {
  const view = prepare(text, font, letterSpacing)
  let width = 0
  for (let index = 0; index < view.widths.length; index += 1) {
    width += view.widths[index] as number
  }
  return width
}

const segmentKind = (kind: string): SegmentKind => {
  if (kind === "text") return "text"
  if (kind === "space" || kind === "preserved-space") return "space"
  if (kind === "zero-width-break") return "break-opportunity"
  if (kind === "soft-hyphen") return "soft-hyphen"
  return "other"
}

let activeLocale: string | undefined

export const configureLocale = (locale?: string) => {
  const next = locale?.trim() || undefined
  if (next === activeLocale) return
  setLocale(next)
  activeLocale = next
}

export const invalidateMeasurements = () => {
  clearCache()
  invalidateNativeWidths()
}

export type WidthSource = {
  advance(text: string): number
  warm(texts: readonly string[]): void
}

type Assembly = {
  readonly view: PretextView
  readonly hyphenWidth: number
  widthAt(index: number, text: string): number
}

const aligned = (view: PretextView, count: number) =>
  view.widths.length === count && view.kinds.length === count

const segmentAt = (
  build: Assembly,
  index: number,
  start: number,
): MeasuredSegment => {
  // Array lengths are validated before assembly, and index is bounded by count.
  const text = build.view.segments[index] as string
  const kind = segmentKind(build.view.kinds[index] as string)
  return {
    text,
    start,
    end: start + text.length,
    kind,
    // Formatting-only break markers do not acquire the spacing that an
    // isolated DOM text probe can report (notably for ZWSP in Firefox).
    width: kind === "soft-hyphen" || kind === "break-opportunity"
      ? 0
      : build.widthAt(index, text),
    lineEndWidth: kind === "soft-hyphen" ? build.hyphenWidth : 0,
  }
}

const measuredSegments = (build: Assembly, text: string) => {
  const count = build.view.segments.length
  if (!aligned(build.view, count)) return null

  const segments: MeasuredSegment[] = []
  let offset = 0
  for (let index = 0; index < count; index += 1) {
    const segment = segmentAt(build, index, offset)
    if (!text.startsWith(segment.text, offset)) return null
    offset = segment.end
    segments.push(segment)
  }

  return offset === text.length ? segments : null
}

const cachedAdvance = (advance: Advance): Advance => {
  const widths = new Map<string, number>([["", 0]])
  return (text) => {
    const cached = widths.get(text)
    if (cached !== undefined) return cached
    const width = advance(text)
    widths.set(text, width)
    return width
  }
}

const plainMeasured = (parts: readonly string[], source: WidthSource): MeasuredSegment[] => {
  source.warm(parts)
  let start = 0
  return parts.map(text => {
    const end = start + text.length
    const segment: MeasuredSegment = {
      text, start, end, kind: text === "\u00ad" ? "soft-hyphen" : text[0] === " " ? "space" : "text",
      width: text === "\u00ad" ? 0 : source.advance(text), lineEndWidth: text === "\u00ad" ? source.advance("-") : 0,
    }
    start = end
    return segment
  })
}

export const createFontMetrics = (
  font: string,
  letterSpacing: number,
  sources: { run?: Advance; paragraph?: WidthSource } = {},
): FontMetrics => {
  const source = sources.paragraph
  const measureRun = source?.advance ?? cachedAdvance(
    sources.run ?? ((text) => preparedRunWidth(text, font, letterSpacing)),
  )
  const hyphenWidth = measureRun("-")

  return {
    font,
    letterSpacing,
    hyphenWidth,
    measureRun,
    ...(source ? { warmRuns: source.warm } : {}),
    measureParagraph(text) {
      const plain = source ? plainParts(text) : null
      if (source && plain) return { segments: plainMeasured(plain, source), hyphenWidth }
      const view = prepare(text, font, letterSpacing)
      source?.warm(view.segments)
      const segments = measuredSegments(
        {
          view,
          hyphenWidth,
          widthAt: source
            ? (_index, segment) => measureRun(segment)
            : (index) => view.widths[index] as number,
        },
        text,
      )
      return segments ? { segments, hyphenWidth } : null
    },
  }
}

/** Use the calibrated native provider for ASCII, with lazy general analysis. */
export const createPlainFontMetrics = (
  font: string,
  advance: Advance,
  fallback: () => FontMetrics,
  punctuation?: () => WidthSource | null,
): FontMetrics => {
  let general: FontMetrics | null = null
  const full = () => general ??= fallback()
  const measureRun = cachedAdvance(text => {
    if (!/[^\x20-\x7e]/u.test(text)) return advance(text)
    const provider = punctuationParts(text) ? punctuation?.() : null
    return provider ? provider.advance(text) : full().measureRun(text)
  })
  const hyphenWidth = measureRun("-")
  const source: WidthSource = { advance: measureRun, warm() {} }
  return {
    font, letterSpacing: 0, hyphenWidth, measureRun,
    measureParagraph(text) {
      const parts = plainParts(text) ?? hyphenatedParts(text)
      if (parts) return { segments: plainMeasured(parts, source), hyphenWidth }
      const prose = punctuation ? punctuationParts(text) : null
      const provider = prose ? punctuation?.() : null
      return prose && provider ? { segments: plainMeasured(prose, provider), hyphenWidth } : full().measureParagraph(text)
    },
  }
}
