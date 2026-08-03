import { clearCache, prepareWithSegments, setLocale } from "@chenglou/pretext"

type PretextView = {
  readonly segments: readonly string[]
  readonly widths: readonly number[]
  readonly kinds: readonly string[]
}

export type SegmentKind =
  | "text"
  | "space"
  | "break-opportunity"
  | "soft-hyphen"
  | "other"

const segmentKind = (kind: string): SegmentKind => {
  if (kind === "text") return "text"
  if (kind === "space" || kind === "preserved-space") return "space"
  if (kind === "zero-width-break") return "break-opportunity"
  if (kind === "soft-hyphen") return "soft-hyphen"
  return "other"
}

export type MeasuredSegment = {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly kind: SegmentKind
  readonly width: number
  readonly lineEndWidth: number
}

export type MeasuredParagraph = {
  readonly segments: readonly MeasuredSegment[]

  readonly hyphenWidth: number
}

export type FontMetrics = {
  readonly font: string
  readonly letterSpacing: number
  readonly hyphenWidth: number
  measureParagraph(text: string): MeasuredParagraph | null

  measureRun(text: string): number
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

const aligned = (view: PretextView, count: number) =>
  view.widths.length === count && view.kinds.length === count

const segmentAt = (
  view: PretextView,
  index: number,
  start: number,
  softHyphenWidth: number,
): MeasuredSegment => {
  const text = view.segments[index] ?? ""
  const kind = segmentKind(view.kinds[index] ?? "")
  return {
    text,
    start,
    end: start + text.length,
    kind,
    width: view.widths[index] ?? 0,
    lineEndWidth: kind === "soft-hyphen" ? softHyphenWidth : 0,
  }
}

const measuredSegments = (
  view: PretextView,
  text: string,
  softHyphenWidth: number,
) => {
  const count = view.segments.length
  if (!aligned(view, count)) return null

  const segments: MeasuredSegment[] = []
  let offset = 0
  for (let index = 0; index < count; index += 1) {
    const segment = segmentAt(view, index, offset, softHyphenWidth)
    offset = segment.end
    segments.push(segment)
  }

  return offset === text.length ? segments : null
}

export const createFontMetrics = (
  font: string,
  letterSpacing: number,
): FontMetrics => {
  const runWidths = new Map<string, number>()

  const prepare = (text: string): PretextView =>
    prepareWithSegments(text, font, {
      letterSpacing,
      whiteSpace: "pre-wrap",
    })

  const measureRun = (text: string): number => {
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

  const hyphenWidth = measureRun("-")
  const softHyphenWidth = hyphenWidth + 2 * letterSpacing

  return {
    font,
    letterSpacing,
    hyphenWidth,
    measureRun,
    measureParagraph(text) {
      const segments = measuredSegments(prepare(text), text, softHyphenWidth)
      return segments ? { segments, hyphenWidth } : null
    },
  }
}
