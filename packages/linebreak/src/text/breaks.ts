import type { PreparedTextWithSegments } from "@chenglou/pretext"
import type { SourceRange } from "../types"
import { SOFT_HYPHEN } from "./markers"

export const isWordSpace = (text: string) => text === " "

const indexHyphenatedText = (hyphenated: string) => {
  const source = hyphenated.replaceAll(SOFT_HYPHEN, "")
  const boundaryIndexes: Array<number | undefined> = Array(source.length + 1)
  let hyphenatedOffset = 0
  let sourceOffset = 0

  while (true) {
    while (hyphenated[hyphenatedOffset] === SOFT_HYPHEN) {
      hyphenatedOffset += SOFT_HYPHEN.length
    }
    boundaryIndexes[sourceOffset] = hyphenatedOffset
    if (hyphenatedOffset >= hyphenated.length) break

    const character = String.fromCodePoint(
      hyphenated.codePointAt(hyphenatedOffset) ?? 0,
    )
    hyphenatedOffset += character.length
    sourceOffset += character.length
  }

  return { boundaryIndexes, source }
}

export const sliceHyphenatedRanges = (
  hyphenated: string,
  ranges: ArrayLike<SourceRange>,
) => {
  const { boundaryIndexes } = indexHyphenatedText(hyphenated)
  return sliceIndexedHyphenatedRanges(hyphenated, boundaryIndexes, ranges)
}

const sliceIndexedHyphenatedRanges = (
  hyphenated: string,
  boundaryIndexes: Array<number | undefined>,
  ranges: ArrayLike<SourceRange>,
) => {
  const slices: string[] = []
  for (let index = 0; index < ranges.length; index += 1) {
    const { start, end } = ranges[index]
    const hyphenatedStart = boundaryIndexes[start]
    const hyphenatedEnd = boundaryIndexes[end]
    if (
      hyphenatedStart === undefined ||
      hyphenatedEnd === undefined ||
      start > end
    ) {
      return null
    }
    slices.push(hyphenated.slice(hyphenatedStart, hyphenatedEnd))
  }
  return slices
}

export const splitAtSourceOffsets = (hyphenated: string, offsets: number[]) => {
  const { boundaryIndexes, source } = indexHyphenatedText(hyphenated)
  const sourceLength = source.length
  const boundaries = [...new Set(offsets)]
    .filter(
      (offset) =>
        offset > 0 &&
        offset < sourceLength &&
        boundaryIndexes[offset] !== undefined,
    )
    .sort((left, right) => left - right)
  let start = 0

  return [...boundaries, sourceLength].map((end) => {
    const fragment = hyphenated.slice(
      boundaryIndexes[start],
      boundaryIndexes[end],
    )
    start = end
    return fragment
  })
}

const splitSoftHyphens = (text: string) => {
  const segments: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== SOFT_HYPHEN) continue
    if (index > start) segments.push(text.slice(start, index))
    segments.push(SOFT_HYPHEN)
    start = index + 1
  }
  if (start < text.length) segments.push(text.slice(start))
  return segments
}

export const splitPreparedSegments = (
  preparedSegments: string[],
  source: string,
  hyphenated: string,
  requiredOffsets: number[],
) => {
  const hyphenatedIndex = indexHyphenatedText(hyphenated)
  if (hyphenatedIndex.source !== source) return null
  const parentOffsets = makeSourceOffsets(preparedSegments, source)
  if (!parentOffsets) return null
  const parentTexts = sliceIndexedHyphenatedRanges(
    hyphenated,
    hyphenatedIndex.boundaryIndexes,
    preparedSegments.map((_, index) => ({
      start: parentOffsets[index],
      end: parentOffsets[index + 1],
    })),
  )
  if (!parentTexts) return null

  const cuts = [...new Set(requiredOffsets)]
    .filter((offset) => offset > 0 && offset < source.length)
    .sort((left, right) => left - right)
  const segments: Array<{
    text: string
    parentIndex: number
    reusesPreparedWidth: boolean
  }> = []
  let cutIndex = 0

  for (let index = 0; index < preparedSegments.length; index += 1) {
    const start = parentOffsets[index]
    const end = parentOffsets[index + 1]
    while (cuts[cutIndex] <= start) cutIndex += 1
    const firstCut = cutIndex
    while (cuts[cutIndex] < end) cutIndex += 1
    const relativeCuts = cuts
      .slice(firstCut, cutIndex)
      .map((offset) => offset - start)
    const text = parentTexts[index]
    let fragments: string[]
    if (relativeCuts.length > 0) {
      fragments = splitAtSourceOffsets(text, relativeCuts).flatMap(
        splitSoftHyphens,
      )
    } else if (text.includes(SOFT_HYPHEN)) {
      fragments = splitSoftHyphens(text)
    } else {
      fragments = [text]
    }
    const parentReusable =
      fragments.length === 1 && fragments[0] === preparedSegments[index]

    for (const fragment of fragments) {
      segments.push({
        text: fragment,
        parentIndex: index,
        reusesPreparedWidth: parentReusable,
      })
    }
  }

  const sourceOffsets = makeSourceOffsets(
    segments.map(({ text }) => text),
    source,
  )
  if (!sourceOffsets) return null

  return segments.map((segment, index) => ({
    ...segment,
    sourceStart: sourceOffsets[index],
    sourceEnd: sourceOffsets[index + 1],
  }))
}

export const makeSourceOffsets = (
  segments: string[],
  source: string,
): number[] | null => {
  const reconstructed = segments.join("").replaceAll(SOFT_HYPHEN, "")
  if (reconstructed !== source) return null

  const offsets = [0]
  let offset = 0
  for (const segment of segments) {
    for (const character of segment) {
      if (character !== SOFT_HYPHEN) offset += character.length
    }
    offsets.push(offset)
  }
  return offsets
}

type PretextSegments = Pick<PreparedTextWithSegments, "segments" | "kinds">
export type MappedBreakOpportunity = "none" | "natural" | "explicit"
type BoundaryBreak = Exclude<MappedBreakOpportunity, "none">

export const pretextBreakOffsets = (
  prepared: PretextSegments,
  source: string,
): Map<number, BoundaryBreak> | null => {
  if (prepared.segments.length !== prepared.kinds.length) return null
  const sourceOffsets = makeSourceOffsets(prepared.segments, source)
  if (!sourceOffsets) return null

  const breaks = new Map<number, BoundaryBreak>()
  for (let index = 0; index < prepared.segments.length - 1; index += 1) {
    const kind = prepared.kinds[index]
    const nextKind = prepared.kinds[index + 1]
    let breakKind: BoundaryBreak
    if (kind === "zero-width-break") breakKind = "explicit"
    else if (kind === "text" && nextKind === "text") breakKind = "natural"
    else continue

    const offset = sourceOffsets[index + 1]
    if (offset <= 0 || offset >= source.length) continue
    if (breakKind === "natural" || !breaks.has(offset)) {
      breaks.set(offset, breakKind)
    }
  }
  return breaks
}

type SourceSegment = {
  text: string
  sourceStart: number
  sourceEnd: number
}

export const mapBreakOffsets = <Segment extends SourceSegment>(
  breaks: ReadonlyMap<number, BoundaryBreak>,
  targetSegments: Segment[],
): Array<Segment & { textBreakAfter: MappedBreakOpportunity }> | null => {
  const mapped = targetSegments.map((segment) => ({
    ...segment,
    textBreakAfter: "none" as MappedBreakOpportunity,
  }))
  const matchedOffsets = new Set<number>()
  for (let index = 0; index < targetSegments.length - 1; index += 1) {
    if (
      targetSegments[index].text === SOFT_HYPHEN ||
      targetSegments[index + 1].text === SOFT_HYPHEN
    ) {
      continue
    }
    const offset = targetSegments[index].sourceEnd
    const breakKind = breaks.get(offset)
    if (!breakKind) continue
    mapped[index].textBreakAfter = breakKind
    matchedOffsets.add(offset)
  }

  return matchedOffsets.size === breaks.size ? mapped : null
}
