import {
  prepareWithSegments,
  setLocale,
  type PreparedTextWithSegments,
} from "@chenglou/pretext"

type PretextView = {
  readonly segments: readonly string[]

  readonly widths: readonly number[]

  readonly lineEndFitAdvances: readonly number[]
  readonly kinds: readonly string[]
}

const asView = (prepared: PreparedTextWithSegments): PretextView =>
  prepared as unknown as PretextView

export type SegmentKind = "text" | "space" | "break-opportunity" | "other"

const segmentKind = (kind: string): SegmentKind => {
  if (kind === "text") return "text"
  if (kind === "space" || kind === "preserved-space") return "space"
  if (kind === "zero-width-break") return "break-opportunity"
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

export const createFontMetrics = (
  font: string,
  letterSpacing: number,
): FontMetrics => {
  const runWidths = new Map<string, number>()

  const prepare = (text: string) =>
    asView(
      prepareWithSegments(text, font, {
        letterSpacing,
        whiteSpace: "pre-wrap",
      }),
    )

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

  return {
    font,
    letterSpacing,
    hyphenWidth,
    measureRun,
    measureParagraph(text) {
      const view = prepare(text)
      const count = view.segments.length
      if (
        view.widths.length !== count ||
        view.kinds.length !== count ||
        view.lineEndFitAdvances.length !== count
      ) {
        return null
      }

      const segments: MeasuredSegment[] = []
      let offset = 0
      for (let index = 0; index < count; index += 1) {
        const segmentText = view.segments[index] ?? ""
        const start = offset
        offset += segmentText.length
        segments.push({
          text: segmentText,
          start,
          end: offset,
          kind: segmentKind(view.kinds[index] ?? ""),
          width: view.widths[index] ?? 0,
          lineEndWidth: view.lineEndFitAdvances[index] ?? 0,
        })
      }

      if (offset !== text.length) return null

      return { segments, hyphenWidth }
    },
  }
}
