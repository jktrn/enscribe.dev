import { clearCache, prepareWithSegments, setLocale } from "@chenglou/pretext"
import type { FontMetrics, MeasuredSegment, SegmentKind } from "./segments"

type PretextView = {
  readonly segments: readonly string[]
  readonly widths: readonly number[]
  readonly kinds: readonly string[]
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
}

export type WidthSource = {
  advance(text: string): number
  warm(texts: readonly string[]): void
}

type Assembly = {
  readonly view: PretextView
  readonly softHyphenWidth: number
  widthAt(index: number, text: string): number
}

const aligned = (view: PretextView, count: number) =>
  view.widths.length === count && view.kinds.length === count

const segmentAt = (
  build: Assembly,
  index: number,
  start: number,
): MeasuredSegment => {
  const text = build.view.segments[index] ?? ""
  const kind = segmentKind(build.view.kinds[index] ?? "")
  return {
    text,
    start,
    end: start + text.length,
    kind,
    width: build.widthAt(index, text),
    lineEndWidth: kind === "soft-hyphen" ? build.softHyphenWidth : 0,
  }
}

const measuredSegments = (build: Assembly, text: string) => {
  const count = build.view.segments.length
  if (!aligned(build.view, count)) return null

  const segments: MeasuredSegment[] = []
  let offset = 0
  for (let index = 0; index < count; index += 1) {
    const segment = segmentAt(build, index, offset)
    offset = segment.end
    segments.push(segment)
  }

  return offset === text.length ? segments : null
}

export const createFontMetrics = (
  font: string,
  letterSpacing: number,
  source?: WidthSource,
): FontMetrics => {
  const runWidths = new Map<string, number>()

  const prepare = (text: string): PretextView =>
    prepareWithSegments(text, font, {
      letterSpacing,
      whiteSpace: "pre-wrap",
    })

  const canvasRun = (text: string): number => {
    if (text.length === 0) return 0
    const cached = runWidths.get(text)
    if (cached !== undefined) return cached

    const view = prepare(text)
    let width = 0
    for (let index = 0; index < view.widths.length; index += 1) {
      width += view.widths[index] ?? 0
    }
    runWidths.set(text, width)
    return width
  }

  const measureRun = source ? source.advance : canvasRun
  const hyphenWidth = measureRun("-")
  const softHyphenWidth = hyphenWidth + 2 * letterSpacing

  return {
    font,
    letterSpacing,
    hyphenWidth,
    measureRun,
    measureParagraph(text) {
      const view = prepare(text)
      source?.warm(view.segments)
      const segments = measuredSegments(
        {
          view,
          softHyphenWidth,
          widthAt: source
            ? (_index, segment) => measureRun(segment)
            : (index) => view.widths[index] ?? 0,
        },
        text,
      )
      return segments ? { segments, hyphenWidth } : null
    },
  }
}
