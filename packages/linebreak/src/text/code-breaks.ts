let graphemeSegmenter: Intl.Segmenter | undefined

const segmentGraphemes = (text: string) => {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  })
  return [...graphemeSegmenter.segment(text)]
}

const separatorPattern = /[./\\,;:]/u
const operatorPattern = /[-=+*%<>!&|?~^]/u
const closingDelimiterPattern = /[)\]}]/u
const repeatableSeparatorPattern = /[./\\]/u
const whitespacePattern = /\s/u

const identifierPattern = /[\p{L}\p{N}$]/u
const letterPattern = /\p{L}/u
const digitPattern = /\p{N}/u
const lowercaseOrDigitPattern = /[\p{Ll}\p{N}]/u
const uppercasePattern = /\p{Lu}/u
const lowercasePattern = /\p{Ll}/u

export const codeBreakPenalties = Object.freeze({
  separator: 3_000,
  closingDelimiter: 4_500,
  operator: 5_500,
  wordSeparator: 7_500,
  identifierBoundary: 8_500,
  letterNumberBoundary: 9_000,
  emergency: 9_500,
})

const codeBreakPenalty = codeBreakPenalties

type Boundary = {
  readonly previous: string
  readonly before: string
  readonly after: string
  readonly next: string
}

type Graphemes = readonly Intl.SegmentData[]

type AddBreak = (offset: number, penalty: number) => void

const segmentAt = (graphemes: Graphemes, index: number) =>
  graphemes[index]?.segment ?? ""

const boundaryAt = (graphemes: Graphemes, index: number): Boundary => ({
  previous: segmentAt(graphemes, index - 2),
  before: segmentAt(graphemes, index - 1),
  after: segmentAt(graphemes, index),
  next: segmentAt(graphemes, index + 1),
})

const touchesWhitespace = ({ before, after }: Boundary) =>
  whitespacePattern.test(before) || whitespacePattern.test(after)

const isSeparatorBreak = ({ previous, before, after }: Boundary) => {
  if (!separatorPattern.test(before)) return false
  const decimalPoint =
    before === "." && digitPattern.test(previous) && digitPattern.test(after)
  const middleOfNamespace = before === ":" && after === ":"
  const middleOfRepeatedSeparator =
    before === after && repeatableSeparatorPattern.test(before)
  return !decimalPoint && !middleOfNamespace && !middleOfRepeatedSeparator
}

const isOperatorBreak = ({ before, after }: Boundary) =>
  operatorPattern.test(before) && !operatorPattern.test(after)

const isWordSeparator = ({ before, after }: Boundary) =>
  before === "_" || (before === "-" && !operatorPattern.test(after))

const isIdentifierBoundary = ({ previous, before, after, next }: Boundary) => {
  const camelCase =
    lowercaseOrDigitPattern.test(before) && uppercasePattern.test(after)
  const acronym =
    uppercasePattern.test(previous) &&
    uppercasePattern.test(before) &&
    lowercasePattern.test(next)
  return camelCase || acronym
}

const isLetterNumberBoundary = ({ before, after }: Boundary) =>
  (letterPattern.test(before) && digitPattern.test(after)) ||
  (digitPattern.test(before) && letterPattern.test(after))

const boundaryPenalty = (boundary: Boundary) => {
  if (isSeparatorBreak(boundary)) return codeBreakPenalty.separator
  if (closingDelimiterPattern.test(boundary.before)) {
    return codeBreakPenalty.closingDelimiter
  }
  if (isOperatorBreak(boundary)) return codeBreakPenalty.operator
  if (isWordSeparator(boundary)) return codeBreakPenalty.wordSeparator
  if (isIdentifierBoundary(boundary)) return codeBreakPenalty.identifierBoundary
  if (isLetterNumberBoundary(boundary)) {
    return codeBreakPenalty.letterNumberBoundary
  }
  return undefined
}

const identifierRunEnd = (graphemes: Graphemes, start: number) => {
  let end = start
  while (
    end < graphemes.length &&
    identifierPattern.test(graphemes[end].segment)
  ) {
    end += 1
  }
  return end
}

const addInteriorBreaks = (
  graphemes: Graphemes,
  start: number,
  end: number,
  add: AddBreak,
) => {
  const length = end - start
  if (length < 5) return
  const interiorBreaks = new Set([
    start + Math.floor(length / 2),
    start + Math.ceil((length * 2) / 3),
  ])
  for (const index of interiorBreaks) {
    if (index < start + 2 || index > end - 2) continue
    add(graphemes[index].index, codeBreakPenalty.emergency)
  }
}

const addEmergencyBreaks = (graphemes: Graphemes, add: AddBreak) => {
  let start = 0
  while (start < graphemes.length) {
    const end = identifierRunEnd(graphemes, start)
    addInteriorBreaks(graphemes, start, end, add)
    start = Math.max(end, start + 1)
  }
}

const addBoundaryBreaks = (
  graphemes: Graphemes,
  textLength: number,
  add: AddBreak,
) => {
  for (let index = 1; index <= graphemes.length; index += 1) {
    const boundary = boundaryAt(graphemes, index)
    if (touchesWhitespace(boundary)) continue

    const penalty = boundaryPenalty(boundary)
    if (penalty === undefined) continue

    add(graphemes[index]?.index ?? textLength, penalty)
  }
}

export const codeBreakOffsets = (text: string) => {
  const graphemes = segmentGraphemes(text)
  const penalties = new Map<number, number>()
  const add: AddBreak = (offset, penalty) => {
    if (offset <= 0 || offset >= text.length) return
    const current = penalties.get(offset)
    if (current === undefined || penalty < current) {
      penalties.set(offset, penalty)
    }
  }

  addBoundaryBreaks(graphemes, text.length, add)
  addEmergencyBreaks(graphemes, add)

  return penalties
}
