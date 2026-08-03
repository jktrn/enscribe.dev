export type Advance = (text: string) => number

export type SegmentKind =
  | "text"
  | "space"
  | "break-opportunity"
  | "soft-hyphen"
  | "other"

export type TextSegment = {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly kind: SegmentKind
}

export type MeasuredSegment = TextSegment & {
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

const SOFT_HYPHEN = "\u00AD"

const SPACES = new Set([
  " ",
  "\t",
  "\n",
  "\f",
  "\r",
  "\u2002",
  "\u2007",
  "\u2009",
])

const ZERO_WIDTHS = new Set(["\u200B", "\u2060", "\uFEFF"])

const DASHES = new Set(["-", "–", "—", "―"])

const CLOSING = /[”’»)\]},.;:!?]/u

const startsSegment = (character: string) =>
  SPACES.has(character) ||
  character === SOFT_HYPHEN ||
  ZERO_WIDTHS.has(character)

const spaceEnd = (text: string, from: number) => {
  let end = from + 1
  while (end < text.length && SPACES.has(text[end] as string)) end += 1
  return end
}

const splitsWord = (character: string, dash: boolean) =>
  dash ? character !== "-" : !CLOSING.test(character)

const wordEnd = (text: string, from: number) => {
  let dashing = DASHES.has(text[from] as string)
  let end = from + 1
  while (end < text.length) {
    const character = text[end] as string
    if (startsSegment(character)) break
    const dash = DASHES.has(character)
    if (dash !== dashing && splitsWord(character, dash)) break
    dashing = dash
    end += 1
  }
  return end
}

const scanFrom = (text: string, from: number) => {
  const character = text[from] as string
  if (SPACES.has(character)) {
    return { end: spaceEnd(text, from), kind: "space" as SegmentKind }
  }
  if (character === SOFT_HYPHEN) {
    return { end: from + 1, kind: "soft-hyphen" as SegmentKind }
  }
  if (ZERO_WIDTHS.has(character)) {
    return { end: from + 1, kind: "break-opportunity" as SegmentKind }
  }
  return { end: wordEnd(text, from), kind: "text" as SegmentKind }
}

export const segmentText = (text: string): TextSegment[] => {
  const segments: TextSegment[] = []
  let start = 0
  while (start < text.length) {
    const { end, kind } = scanFrom(text, start)
    segments.push({ text: text.slice(start, end), start, end, kind })
    start = end
  }
  return segments
}

const measuredSegment = (
  segment: TextSegment,
  measure: Advance,
  softHyphenWidth: number,
): MeasuredSegment => {
  const soft = segment.kind === "soft-hyphen"
  return {
    text: segment.text,
    start: segment.start,
    end: segment.end,
    kind: segment.kind,
    width: soft ? 0 : measure(segment.text),
    lineEndWidth: soft ? softHyphenWidth : 0,
  }
}

const tiles = (segment: TextSegment, offset: number) =>
  segment.start === offset && segment.end === offset + segment.text.length

const measureAll = (
  segments: readonly TextSegment[],
  text: string,
  measure: Advance,
  softHyphenWidth: number,
) => {
  const measured: MeasuredSegment[] = []
  let offset = 0
  for (const segment of segments) {
    if (!tiles(segment, offset)) return null
    measured.push(measuredSegment(segment, measure, softHyphenWidth))
    offset = segment.end
  }
  return offset === text.length ? measured : null
}

export const createMetrics = (options: {
  measure: Advance
  letterSpacing?: number
  font?: string
  segment?: (text: string) => readonly TextSegment[]
}): FontMetrics => {
  const { measure } = options
  const letterSpacing = options.letterSpacing ?? 0
  const hyphenWidth = measure("-")
  const softHyphenWidth = hyphenWidth + 2 * letterSpacing
  const segment = options.segment ?? segmentText

  return {
    font: options.font ?? "",
    letterSpacing,
    hyphenWidth,
    measureRun: measure,
    measureParagraph(text) {
      const segments = measureAll(segment(text), text, measure, softHyphenWidth)
      return segments ? { segments, hyphenWidth } : null
    },
  }
}
