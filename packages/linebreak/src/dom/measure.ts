import {
  configurePretextLocale,
  measureTextBatch,
  prepareWithSegments,
} from "../adapters/pretext"
import {
  codeWrapper,
  type ExtractedBlock,
  extractBlock,
  type InlineItem,
  itemEdgeWidths,
} from "./extract"
import {
  type ExactTextCache,
  type ExactTextSegment,
  type ExactTextStyle,
  type ExactTextRun,
  exactTextStyle,
  measureExactSegments,
  measureExactText,
} from "./exact"
import { type TextMetrics, readTextMetrics } from "./typography"
import { createStyleReader, cssPixels, type StyleReader } from "./styles"
import type { PreparedParagraph } from "../layout/line-model"
import { SOFT_HYPHEN } from "../text/markers"
import { planParagraph, type TextPlanSource } from "../text/plan"

export type MetricSource = "canvas" | "dom"

type Typography = TextMetrics & {
  exact?: ExactTextStyle
  style: CSSStyleDeclaration
}

type ItemTypography = Typography & {
  item: InlineItem
  itemIndex: number
}

const exactTextRuns = (
  styledItems: ItemTypography[],
  itemSegmentIndexes: number[][],
  prepared: PreparedParagraph,
) => {
  const runs: ExactTextRun[] = []
  for (const { item, itemIndex } of styledItems) {
    if (item.kind !== "text") continue

    const hyphenIndexes: number[] = []
    const slices = []
    for (const index of itemSegmentIndexes[itemIndex]) {
      const segment = prepared.segments[index]
      if (segment.text === SOFT_HYPHEN) {
        hyphenIndexes.push(index)
      } else {
        slices.push({
          index,
          start: segment.sourceStart - item.start,
          end: segment.sourceEnd - item.start,
        })
      }
    }
    if (hyphenIndexes.length > 0 || slices.length > 0) {
      runs.push({
        sourceElement: item.sourceElement,
        text: item.text,
        hyphenIndexes,
        slices,
      })
    }
  }
  return runs
}

type MeasurementGroup = {
  font: string
  letterSpacing: number
  hyphenIndexes: number[]
  textIndexes: Map<string, number[]>
}

const typographyKey = (typography: Typography) =>
  `${typography.font}\u0000${typography.letterSpacing}`

const samePretextTypography = (left: ItemTypography, right: ItemTypography) =>
  left.font === right.font && left.letterSpacing === right.letterSpacing

const addMeasurement = (
  groups: Map<string, MeasurementGroup>,
  typography: Typography,
  index: number,
  text: string,
) => {
  const key = typographyKey(typography)
  let group = groups.get(key)
  if (!group) {
    group = {
      font: typography.font,
      letterSpacing: typography.letterSpacing,
      hyphenIndexes: [],
      textIndexes: new Map(),
    }
    groups.set(key, group)
  }
  if (text === SOFT_HYPHEN) {
    group.hyphenIndexes.push(index)
    return
  }
  const indexes = group.textIndexes.get(text) ?? []
  indexes.push(index)
  group.textIndexes.set(text, indexes)
}

const addItemEdgeWidths = (
  paragraph: PreparedParagraph,
  extracted: ExtractedBlock,
  itemSegmentIndexes: number[][],
) => {
  let contentSegmentIndexes: number[] | undefined
  const segmentBeside = (item: Extract<InlineItem, { kind: "anchor" }>) => {
    contentSegmentIndexes ??= paragraph.segments.flatMap((segment, index) =>
      segment.text === SOFT_HYPHEN ? [] : [index],
    )
    let low = 0
    let high = contentSegmentIndexes.length
    while (low < high) {
      const middle = (low + high) >>> 1
      const segment = paragraph.segments[contentSegmentIndexes[middle]]
      const beforeAnchor =
        item.affinity === "next"
          ? segment.sourceStart < item.start
          : segment.sourceEnd <= item.start
      if (beforeAnchor) low = middle + 1
      else high = middle
    }
    const position = item.affinity === "next" ? low : low - 1
    return contentSegmentIndexes[position] ?? -1
  }

  for (let itemIndex = 0; itemIndex < extracted.items.length; itemIndex += 1) {
    const item = extracted.items[itemIndex]
    if (item.kind === "anchor") {
      const segmentIndex = segmentBeside(item)
      if (segmentIndex >= 0) {
        const edges = itemEdgeWidths(extracted, item)
        paragraph.segments[segmentIndex].edgeWidth +=
          edges.leading + edges.trailing
      }
      continue
    }
    if (item.kind === "box") continue

    const coreStart = item.start + (item.text.startsWith(" ") ? 1 : 0)
    const coreEnd = item.end - (item.text.endsWith(" ") ? 1 : 0)
    if (coreStart >= coreEnd) continue

    let first: number | undefined
    let last: number | undefined
    for (const index of itemSegmentIndexes[itemIndex]) {
      const segment = paragraph.segments[index]
      if (
        segment.text !== SOFT_HYPHEN &&
        sourceRangeOverlaps(
          segment.sourceStart,
          segment.sourceEnd,
          coreStart,
          coreEnd,
        )
      ) {
        first ??= index
        last = index
      }
    }
    if (first === undefined || last === undefined) continue

    const edges = itemEdgeWidths(extracted, item)
    paragraph.segments[first].edgeWidth += edges.leading
    paragraph.segments[last].edgeWidth += edges.trailing
  }
}

const sourceRangeOverlaps = (
  start: number,
  end: number,
  rangeStart: number,
  rangeEnd: number,
) => start < rangeEnd && end > rangeStart

const makeTextPlan = (
  extracted: ExtractedBlock,
  styledItems: readonly ItemTypography[],
): TextPlanSource => {
  const codeRanges = []
  for (const [element, range] of extracted.wrappers) {
    if (element.localName === "code") codeRanges.push(range)
  }

  return {
    text: extracted.text,
    items: styledItems.map(({ item }) => ({
      start: item.start,
      end: item.end,
      hyphenate:
        item.kind === "text" && item.allowsHyphenation && !codeWrapper(item),
    })),
    codeRanges,
    breakRestrictions: extracted.breakRestrictions,
  }
}

const measureStyledParagraph = (
  extracted: ExtractedBlock,
  language: string,
  metricSource: MetricSource,
  exactTextCache: ExactTextCache,
  styleOf: StyleReader,
): PreparedParagraph | null => {
  const typographyByElement = new Map<Element, Typography>()
  const styledItems: ItemTypography[] = []
  for (let itemIndex = 0; itemIndex < extracted.items.length; itemIndex += 1) {
    const item = extracted.items[itemIndex]
    if (item.kind === "anchor") continue
    let typography = typographyByElement.get(item.sourceElement)
    if (!typography) {
      const style = styleOf(item.sourceElement)
      typography = {
        style,
        ...readTextMetrics(style),
      }
      typographyByElement.set(item.sourceElement, typography)
    }
    const styled = { item, itemIndex, ...typography }
    styledItems.push(styled)
  }

  const representative =
    styledItems.find(({ item }) => item.kind === "text") ?? styledItems[0]
  if (!representative) return null

  configurePretextLocale(language)

  const paragraphPreparation = prepareWithSegments(
    "paragraph",
    extracted.text,
    representative.font,
    { letterSpacing: representative.letterSpacing },
  )
  const textPlan = makeTextPlan(extracted, styledItems)
  const plannedSegments = planParagraph(
    textPlan,
    paragraphPreparation,
    language,
  )
  if (!plannedSegments) return null

  const prepared: PreparedParagraph = {
    segments: plannedSegments.map((segment) => ({
      text: segment.text,
      sourceStart: segment.sourceStart,
      sourceEnd: segment.sourceEnd,
      width: 0,
      edgeWidth: 0,
      discretionaryHyphenWidth: 0,
      breakAfter: segment.breakAfter,
    })),
  }
  const measurementGroups = new Map<string, MeasurementGroup>()
  const itemSegmentIndexes = extracted.items.map(() => [] as number[])
  const exactSegments: ExactTextSegment[] = []

  for (let index = 0; index < prepared.segments.length; index += 1) {
    const segment = prepared.segments[index]
    const sourceSegment = plannedSegments[index]
    const typography = styledItems[sourceSegment.itemIndex]
    if (!typography) return null
    const { item, itemIndex } = typography
    itemSegmentIndexes[itemIndex].push(index)

    if (item.kind === "box") {
      const edges = itemEdgeWidths(extracted, item)
      segment.width =
        item.sourceElement.getBoundingClientRect().width +
        cssPixels(typography.style.marginInlineStart) +
        cssPixels(typography.style.marginInlineEnd) +
        edges.leading +
        edges.trailing
      continue
    }

    const matchesRepresentative = samePretextTypography(
      typography,
      representative,
    )
    if (matchesRepresentative) {
      segment.discretionaryHyphenWidth =
        paragraphPreparation.discretionaryHyphenWidth
    }

    if (metricSource === "dom") continue
    const exactText = segment.text === SOFT_HYPHEN ? "-" : segment.text
    if (typography.requiresExactWidth(exactText)) {
      typography.exact ??= exactTextStyle(item.sourceElement, typography.style)
      exactSegments.push({
        index,
        style: typography.exact,
        target: segment.text === SOFT_HYPHEN ? "discretionary-hyphen" : "width",
        text: exactText,
      })
      continue
    }
    if (
      segment.text !== SOFT_HYPHEN &&
      sourceSegment.reusesPreparedWidth &&
      matchesRepresentative
    ) {
      segment.width = paragraphPreparation.widths[sourceSegment.parentIndex]
    } else {
      addMeasurement(measurementGroups, typography, index, segment.text)
    }
  }

  for (const group of measurementGroups.values()) {
    const texts = [...group.textIndexes.keys()]
    if (texts.length === 0) return null
    const measurement = measureTextBatch(texts, group.font, group.letterSpacing)
    if (!measurement) return null

    for (let textIndex = 0; textIndex < texts.length; textIndex += 1) {
      for (const segmentIndex of group.textIndexes.get(texts[textIndex]) ??
        []) {
        prepared.segments[segmentIndex].width = measurement.widths[textIndex]
      }
    }
    for (const index of group.hyphenIndexes) {
      prepared.segments[index].discretionaryHyphenWidth =
        measurement.discretionaryHyphenWidth
    }
  }

  if (metricSource === "dom") {
    const runs = exactTextRuns(styledItems, itemSegmentIndexes, prepared)
    measureExactText(prepared, runs)
  } else {
    measureExactSegments(prepared, exactSegments, exactTextCache)
  }

  addItemEdgeWidths(prepared, extracted, itemSegmentIndexes)
  return prepared
}

export const measureParagraph = (
  element: HTMLElement,
  style: CSSStyleDeclaration,
  language: string,
  metricSource: MetricSource,
  exactTextCache: ExactTextCache,
) => {
  const styleOf = createStyleReader(element, style)
  const extracted = extractBlock(element, styleOf)
  if (!extracted) return null

  const prepared = measureStyledParagraph(
    extracted,
    language,
    metricSource,
    exactTextCache,
    styleOf,
  )
  return prepared ? { extracted, prepared } : null
}
