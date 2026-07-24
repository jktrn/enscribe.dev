import { isWordSpace } from "../text/breaks"
import { OBJECT_REPLACEMENT, SOFT_HYPHEN } from "../text/markers"
import { defaultLayoutPolicy } from "./default-policy"

export type BreakOpportunity =
  | { kind: "none" }
  | { kind: "space" }
  | { kind: "hyphen" }
  | { kind: "natural"; penalty?: number }
  | { kind: "explicit"; penalty?: number }

type PreparedSegment = {
  text: string
  sourceStart: number
  sourceEnd: number
  width: number
  edgeWidth: number
  discretionaryHyphenWidth: number
  breakAfter: BreakOpportunity
}

export type PreparedParagraph = {
  segments: PreparedSegment[]
}

type BreakKind = "end" | "hyphen" | "space" | "zero-width"

type BreakCandidate = {
  segmentIndex: number
  sourceOffset: number
  discretionaryHyphen: boolean
  hyphenWidth: number
  kind: BreakKind
  penalty: number
}

export type MeasuredLine = {
  start: number
  end: number
  discretionaryHyphen: boolean
  naturalWidth: number
  hyphenWidth: number
  spaceWidth: number
  spaceCount: number
  atomCount: number
  naturalBreakCount: number
  characterCount: number
  adjustmentRatio: number
  wordSpacing: number
  letterSpacing: number
  trackingRatio: number
  trackingLimit: number
  breakKind: BreakKind
}

export type OptimizedLine = Pick<
  MeasuredLine,
  | "start"
  | "end"
  | "discretionaryHyphen"
  | "naturalWidth"
  | "wordSpacing"
  | "letterSpacing"
  | "spaceCount"
  | "naturalBreakCount"
  | "characterCount"
  | "spaceWidth"
  | "trackingLimit"
  | "breakKind"
>

type ParagraphMeasures = {
  wordWidth: number[]
  edgeWidth: number[]
  spaceWidth: number[]
  spaceCount: number[]
  atomCount: number[]
  naturalBreakCount: number[]
  characterCount: number[]
  trimmedEnd: number[]
}

type LineVerdict = "admit" | "skip" | "stop"

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
})

const countGraphemes = (text: string) => {
  let count = 0
  for (const _ of graphemeSegmenter.segment(text)) count += 1
  return count
}
const makeCandidates = (prepared: PreparedParagraph) => {
  const candidates: BreakCandidate[] = [
    {
      segmentIndex: 0,
      sourceOffset: prepared.segments[0]?.sourceStart ?? 0,
      discretionaryHyphen: false,
      hyphenWidth: 0,
      kind: "end",
      penalty: 0,
    },
  ]

  for (let index = 0; index < prepared.segments.length; index += 1) {
    const segment = prepared.segments[index]
    const opportunity = segment.breakAfter
    if (index < prepared.segments.length - 1 && opportunity.kind !== "none") {
      const discretionaryHyphen = opportunity.kind === "hyphen"
      const kind =
        opportunity.kind === "hyphen" || opportunity.kind === "space"
          ? opportunity.kind
          : "zero-width"
      candidates.push({
        segmentIndex: index + 1,
        sourceOffset: segment.sourceEnd,
        discretionaryHyphen,
        hyphenWidth: discretionaryHyphen ? segment.discretionaryHyphenWidth : 0,
        kind,
        penalty: "penalty" in opportunity ? (opportunity.penalty ?? 0) : 0,
      })
    }
  }

  if (candidates.at(-1)?.segmentIndex !== prepared.segments.length) {
    candidates.push({
      segmentIndex: prepared.segments.length,
      sourceOffset: prepared.segments.at(-1)?.sourceEnd ?? 0,
      discretionaryHyphen: false,
      hyphenWidth: 0,
      kind: "end",
      penalty: 0,
    })
  }

  return candidates
}

const measureParagraph = (prepared: PreparedParagraph): ParagraphMeasures => {
  const measures: ParagraphMeasures = {
    wordWidth: [0],
    edgeWidth: [0],
    spaceWidth: [0],
    spaceCount: [0],
    atomCount: [0],
    naturalBreakCount: [0],
    characterCount: [0],
    trimmedEnd: [0],
  }

  for (let index = 0; index < prepared.segments.length; index += 1) {
    const segment = prepared.segments[index]
    const softHyphen = segment.text === SOFT_HYPHEN
    const space = !softHyphen && isWordSpace(segment.text)
    const word = !softHyphen && !space
    measures.wordWidth.push(
      measures.wordWidth[index] + (word ? segment.width : 0),
    )
    measures.edgeWidth.push(measures.edgeWidth[index] + segment.edgeWidth)
    measures.spaceWidth.push(
      measures.spaceWidth[index] + (space ? segment.width : 0),
    )
    measures.spaceCount.push(measures.spaceCount[index] + (space ? 1 : 0))
    measures.atomCount.push(
      measures.atomCount[index] + (segment.text === OBJECT_REPLACEMENT ? 1 : 0),
    )
    measures.naturalBreakCount.push(
      measures.naturalBreakCount[index] +
        (segment.breakAfter.kind === "natural" ? 1 : 0),
    )
    measures.characterCount.push(
      measures.characterCount[index] +
        (softHyphen || segment.text === OBJECT_REPLACEMENT
          ? 0
          : countGraphemes(segment.text)),
    )
    measures.trimmedEnd.push(space ? measures.trimmedEnd[index] : index + 1)
  }

  return measures
}

const fitnessClass = (ratio: number) => {
  if (ratio < -0.12) return 0
  if (ratio <= 0.25) return 1
  if (ratio <= 0.65) return 2
  return 3
}

export class ParagraphLineModel {
  readonly candidates: readonly BreakCandidate[]
  private readonly measures: ParagraphMeasures

  constructor(prepared: PreparedParagraph) {
    this.candidates = makeCandidates(prepared)
    this.measures = measureParagraph(prepared)
  }

  atWidth(maxWidth: number) {
    return new ParagraphLayout(this.candidates, this.measures, maxWidth)
  }
}

class ParagraphLayout {
  constructor(
    readonly candidates: readonly BreakCandidate[],
    private readonly measures: ParagraphMeasures,
    private readonly maxWidth: number,
  ) {}

  measure(fromIndex: number, toIndex: number): MeasuredLine {
    const from = this.candidates[fromIndex]
    const to = this.candidates[toIndex]
    const start = from.segmentIndex
    const end = Math.max(start, this.measures.trimmedEnd[to.segmentIndex])
    const hyphenWidth = to.hyphenWidth
    const wordWidth =
      this.measures.wordWidth[end] -
      this.measures.wordWidth[start] +
      hyphenWidth
    const edgeWidth =
      this.measures.edgeWidth[to.segmentIndex] - this.measures.edgeWidth[start]
    const spaceWidth =
      this.measures.spaceWidth[end] - this.measures.spaceWidth[start]
    const spaceCount =
      this.measures.spaceCount[end] - this.measures.spaceCount[start]
    const naturalBreakCount =
      this.measures.naturalBreakCount[end] -
      this.measures.naturalBreakCount[start]
    const characterCount =
      this.measures.characterCount[end] -
      this.measures.characterCount[start] +
      (to.discretionaryHyphen ? 1 : 0)
    const naturalWidth = wordWidth + edgeWidth + spaceWidth
    const adjustmentRatio =
      spaceWidth > 0 ? (this.maxWidth - naturalWidth) / spaceWidth : 0
    const ratio = Math.min(
      defaultLayoutPolicy.wordSpacing.stretch,
      Math.max(defaultLayoutPolicy.wordSpacing.shrink, adjustmentRatio),
    )
    const wordSpacing = spaceCount > 0 ? (spaceWidth * ratio) / spaceCount : 0
    const residual = this.maxWidth - naturalWidth - wordSpacing * spaceCount
    const letterSpacing =
      characterCount > 0 && (spaceCount > 0 || naturalBreakCount > 0)
        ? residual / characterCount
        : 0
    const averageGlyphWidth =
      characterCount > 0 ? wordWidth / characterCount : 0
    const trackingLimit = Math.max(
      defaultLayoutPolicy.fit.minimumTrackingPx,
      averageGlyphWidth * defaultLayoutPolicy.fit.maximumTrackingRatio,
    )

    return {
      start: from.sourceOffset,
      end: to.sourceOffset,
      discretionaryHyphen: to.discretionaryHyphen,
      naturalWidth,
      hyphenWidth,
      spaceWidth,
      spaceCount,
      atomCount: this.measures.atomCount[end] - this.measures.atomCount[start],
      naturalBreakCount,
      characterCount,
      adjustmentRatio,
      wordSpacing,
      letterSpacing,
      trackingRatio: trackingLimit > 0 ? letterSpacing / trackingLimit : 0,
      trackingLimit,
      breakKind: to.kind,
    }
  }

  verdict(line: MeasuredLine, isLastLine: boolean): LineVerdict {
    if (
      line.naturalWidth >
      this.maxWidth + defaultLayoutPolicy.fit.overflowTolerance
    ) {
      const trackingCapacity =
        line.spaceCount > 0 || line.naturalBreakCount > 0
          ? line.characterCount * line.trackingLimit
          : 0
      const tightestBaseWidth =
        line.naturalWidth -
        line.hyphenWidth +
        line.spaceWidth * defaultLayoutPolicy.wordSpacing.shrink -
        trackingCapacity
      if (
        tightestBaseWidth >
        this.maxWidth + defaultLayoutPolicy.fit.overflowTolerance
      ) {
        return "stop"
      }
      if (isLastLine) return "skip"
    }
    if (isLastLine) return "admit"
    if (
      line.breakKind === "space" &&
      line.spaceCount === 0 &&
      Math.abs(this.maxWidth - line.naturalWidth) >
        defaultLayoutPolicy.fit.overflowTolerance
    ) {
      return "skip"
    }

    const sufficientlyFilled =
      line.naturalWidth >= this.maxWidth * 0.72 &&
      (line.atomCount > 0 ||
        line.naturalBreakCount > 0 ||
        line.discretionaryHyphen ||
        line.breakKind === "zero-width")
    if (
      line.spaceCount === 0 &&
      line.naturalWidth < this.maxWidth * 0.9 &&
      !sufficientlyFilled
    ) {
      return "skip"
    }
    if (Math.abs(line.trackingRatio) > 1) return "skip"
    return "admit"
  }

  fitness(line: MeasuredLine, isLastLine: boolean) {
    return isLastLine ? 1 : fitnessClass(line.adjustmentRatio)
  }

  demerits(line: MeasuredLine, isLastLine: boolean) {
    const fill = line.naturalWidth / this.maxWidth
    if (isLastLine) {
      return fill < 0.35 ? ((0.35 - fill) * 700) ** 2 : 0
    }

    let cost =
      defaultLayoutPolicy.optimizer.badnessMultiplier *
      Math.abs(line.adjustmentRatio) ** 3
    cost +=
      defaultLayoutPolicy.optimizer.trackingMultiplier *
      Math.min(1, Math.abs(line.trackingRatio)) ** 4
    const looseLineExcess =
      line.adjustmentRatio - defaultLayoutPolicy.wordSpacing.stretch
    if (line.spaceCount > 0 && looseLineExcess > 0) {
      cost +=
        defaultLayoutPolicy.optimizer.looseLineBase +
        looseLineExcess ** 2 *
          defaultLayoutPolicy.optimizer.looseLineExcessMultiplier
    }
    const tightExcess =
      defaultLayoutPolicy.wordSpacing.shrink - line.adjustmentRatio
    if (line.spaceCount > 0 && tightExcess > 0) {
      cost +=
        defaultLayoutPolicy.optimizer.tightBase +
        tightExcess ** 2 * defaultLayoutPolicy.optimizer.tightExcessMultiplier
    }
    if (line.spaceCount === 0) cost += ((1 - fill) * 100) ** 2
    return cost
  }
}
