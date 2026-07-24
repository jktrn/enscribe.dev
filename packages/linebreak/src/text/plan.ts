import type { PreparedTextWithSegments } from "@chenglou/pretext"
import englishHyphenation from "hyphen/en-us"
import type { BreakOpportunity } from "../layout/line-model"
import type { SourceRange } from "../types"
import {
  type MappedBreakOpportunity,
  mapBreakOffsets,
  pretextBreakOffsets,
  isWordSpace,
  sliceHyphenatedRanges,
  splitPreparedSegments,
} from "./breaks"
import { codeBreakOffsets } from "./code-breaks"
import { SOFT_HYPHEN } from "./markers"

const { hyphenateSync } = englishHyphenation

type TextPlanItem = {
  start: number
  end: number
  hyphenate: boolean
}

export type TextPlanSource = {
  text: string
  items: readonly TextPlanItem[]
  codeRanges: readonly SourceRange[]
  breakRestrictions: readonly SourceRange[]
}

export type PlannedSegment = {
  text: string
  sourceStart: number
  sourceEnd: number
  itemIndex: number
  parentIndex: number
  reusesPreparedWidth: boolean
  breakAfter: BreakOpportunity
}

type PretextSegments = Pick<PreparedTextWithSegments, "segments" | "kinds">

const restrictionContaining = (
  ranges: readonly SourceRange[],
  offset: number,
) => {
  let low = 0
  let high = ranges.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (ranges[middle].start <= offset) low = middle + 1
    else high = middle
  }
  const range = ranges[low - 1]
  return range && offset < range.end ? range : undefined
}

const breakAllowedAt = (ranges: readonly SourceRange[], offset: number) =>
  ranges.length === 0 || restrictionContaining(ranges, offset) === undefined

const usesEnglishHyphenation = (language: string) => {
  try {
    return new Intl.Locale(language).language === "en"
  } catch {
    return false
  }
}

const segmentBreak = (
  text: string,
  opportunity: MappedBreakOpportunity,
  penalty?: number,
): BreakOpportunity => {
  if (text === SOFT_HYPHEN) return { kind: "hyphen" }
  if (isWordSpace(text)) return { kind: "space" }
  if (opportunity === "natural") {
    return penalty === undefined
      ? { kind: "natural" }
      : { kind: "natural", penalty }
  }
  if (opportunity === "explicit" || penalty !== undefined) {
    return penalty === undefined
      ? { kind: "explicit" }
      : { kind: "explicit", penalty }
  }
  return { kind: "none" }
}

const codeBreakPenalties = (source: TextPlanSource) => {
  const penalties = new Map<number, number>()
  for (const range of source.codeRanges) {
    const text = source.text.slice(range.start, range.end)
    for (const [offset, penalty] of codeBreakOffsets(text)) {
      const sourceOffset = range.start + offset
      if (!breakAllowedAt(source.breakRestrictions, sourceOffset)) continue
      const current = penalties.get(sourceOffset)
      if (current === undefined || penalty < current) {
        penalties.set(sourceOffset, penalty)
      }
    }
  }
  return penalties
}

type SourceSegment = {
  text: string
  sourceStart: number
  sourceEnd: number
}

const indexSegmentsByItem = <Segment extends SourceSegment>(
  items: readonly TextPlanItem[],
  segments: Segment[],
) => {
  const indexed: Array<Segment & { itemIndex: number }> = []
  let itemIndex = 0

  for (const segment of segments) {
    const { sourceStart: start, sourceEnd: end, text } = segment
    if (text === SOFT_HYPHEN) {
      while (
        itemIndex < items.length &&
        !(items[itemIndex].start < start && start <= items[itemIndex].end)
      ) {
        itemIndex += 1
      }
    } else {
      while (itemIndex < items.length && items[itemIndex].end <= start) {
        itemIndex += 1
      }
    }

    const item = items[itemIndex]
    if (
      !item ||
      (text !== SOFT_HYPHEN &&
        (start < item.start || end > item.end || start === end))
    ) {
      return null
    }
    indexed.push({ ...segment, itemIndex })
  }

  return indexed
}

const hyphenateItems = (source: TextPlanSource, language: string) => {
  if (!usesEnglishHyphenation(language)) return source.text

  const canHyphenate = (item: TextPlanItem) => item.hyphenate
  if (!source.items.some(canHyphenate)) return source.text

  const hyphenated = hyphenateSync(source.text, { minWordLength: 6 })
  if (source.items.every(canHyphenate)) return hyphenated

  const slices = sliceHyphenatedRanges(hyphenated, source.items)
  if (!slices) return null
  return source.items
    .map((item, index) =>
      canHyphenate(item)
        ? slices[index]
        : source.text.slice(item.start, item.end),
    )
    .join("")
}

export const planParagraph = (
  source: TextPlanSource,
  pretext: PretextSegments,
  language: string,
): PlannedSegment[] | null => {
  const breaks = pretextBreakOffsets(pretext, source.text)
  if (!breaks) return null

  const hyphenated = hyphenateItems(source, language)
  if (hyphenated === null) return null
  const penalties = codeBreakPenalties(source)
  const requiredOffsets = [...penalties.keys()]
  for (const item of source.items) {
    requiredOffsets.push(item.start, item.end)
  }
  const split = splitPreparedSegments(
    pretext.segments,
    source.text,
    hyphenated,
    requiredOffsets,
  )
  if (!split) return null

  const indexed = indexSegmentsByItem(source.items, split)
  if (!indexed) return null
  const mapped = mapBreakOffsets(breaks, indexed)
  if (!mapped) return null

  return mapped.map((segment) => {
    const breakAfter = breakAllowedAt(
      source.breakRestrictions,
      segment.sourceEnd,
    )
      ? segmentBreak(
          segment.text,
          segment.textBreakAfter,
          penalties.get(segment.sourceEnd),
        )
      : { kind: "none" as const }
    return {
      text: segment.text,
      sourceStart: segment.sourceStart,
      sourceEnd: segment.sourceEnd,
      itemIndex: segment.itemIndex,
      parentIndex: segment.parentIndex,
      reusesPreparedWidth: segment.reusesPreparedWidth,
      breakAfter,
    }
  })
}
