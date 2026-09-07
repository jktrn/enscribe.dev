import {
  correctionSize,
  prefixValue,
  type CapacityCorrection,
} from "../numeric/prefix"
import {
  breakPenalty,
  drawsHyphen,
  isFlaggedBreak,
  isForced,
  isParagraphEnd,
  isRenderedSpace,
  type Item,
  lineEndWidth,
  lineStartWidth,
} from "../items"
import type { Hangs } from "../protrusion"
import type { Sums } from "../sums"
import type { Boundary, BreakKind, Edge } from "./types"

const openingSource = (
  items: readonly Item[],
  position: number,
  start: number,
) => {
  if (position < 0) {
    // A source-only leading marker is discarded numerically but belongs to
    // the first source slice. Stop before any later retained content.
    for (let index = 0; index <= start; index += 1) {
      const source = items[index]?.source
      if (source) return source.start
    }
    return null
  }
  const previous = items[position] as Item
  if (previous.kind === "discretionary") return previous.breakOffset
  return previous.source?.end ?? items[start]?.source?.start ?? null
}

export const openingAt = (
  items: readonly Item[],
  sums: Sums,
  hangs: Hangs | null,
  position: number,
): Boundary => endpointAt(items, sums, hangs, position, 0, 0)

const breakKindAt = (
  item: Item,
  final: boolean,
  forced: boolean,
  discardedSpaces: number,
): BreakKind => {
  if (drawsHyphen(item)) return "hyphen"
  if (isRenderedSpace(item)) return "space"
  if (item.kind === "penalty" && forced) return final ? "end" : "forced"
  return discardedSpaces > 0 ? "space" : "none"
}

const endpointAt = (
  items: readonly Item[], sums: Sums, hangs: Hangs | null,
  position: number, penalty: number, sourceEnd: number,
): Edge => {
  const item = items[position]
  const start = sums.starts[position + 1] as number
  const startWidth = sums.width[start] as number
  const startStretch = sums.stretch[start] as number
  const startShrink = sums.shrink[start] as number
  const startSpaces = sums.spaces[start] as number
  const forced = isForced(penalty)
  const final = isParagraphEnd(items, position)
  const width = position < 0 ? 0 : sums.width[position] as number
  const shrink = position < 0 ? 0 : sums.shrink[position] as number
  return {
    position, start, startWidth, startStretch, startShrink, startSpaces,
    sourceStart: openingSource(items, position, start),
    hangStart: hangs?.start[position + 1] ?? 0,
    leading: item ? lineStartWidth(item) : 0,
    flagged: isFlaggedBreak(item),
    startLoss: correctionSize(sums.corrections.width, startWidth, start) +
      correctionSize(sums.corrections.shrink, startShrink, start),
    sourceEnd,
    penaltyCost: forced ? 0 : penalty * Math.abs(penalty),
    forced, final, width,
    stretch: position < 0 ? 0 : sums.stretch[position] as number,
    shrink, spaces: position < 0 ? 0 : sums.spaces[position] as number,
    trailing: item ? lineEndWidth(item) : 0,
    hangEnd: hangs?.end[position] ?? 0,
    breakKind: item ? breakKindAt(item, final, forced, startSpaces - (sums.spaces[position + 1] as number)) : "none",
    minimumWidth: Number.POSITIVE_INFINITY,
    minimumTightWidth: Number.POSITIVE_INFINITY,
    roundingScale: 0,
    roundingLoss: position < 0 ? 0 : correctionSize(sums.corrections.width, width, position) +
      correctionSize(sums.corrections.shrink, shrink, position),
  }
}

const boundFutureWidths = (
  edges: Edge[],
  shrinkCorrection: CapacityCorrection | null,
) => {
  let width = Number.POSITIVE_INFINITY
  let tight = Number.POSITIVE_INFINITY
  let scale = 0
  let loss = 0
  for (let index = edges.length - 1; index >= 0; index -= 1) {
    const edge = edges[index] as Edge
    if (edge.forced) {
      width = Number.POSITIVE_INFINITY
      tight = Number.POSITIVE_INFINITY
      scale = 0
      loss = 0
    }
    const natural = edge.width + edge.trailing - edge.hangEnd
    const shrink = prefixValue(shrinkCorrection, edge.shrink)
    scale = Math.max(
      scale,
      Math.abs(edge.width),
      Math.abs(shrink),
      Math.abs(edge.trailing),
      Math.abs(edge.hangEnd),
    )
    width = Math.min(width, natural)
    tight = Math.min(tight, natural - shrink)
    edge.minimumWidth = width
    edge.minimumTightWidth = tight
    edge.roundingScale = scale
    loss = Math.max(loss, edge.roundingLoss)
    edge.roundingLoss = loss
  }
}

export const breakpoints = (
  items: readonly Item[],
  sums: Sums,
  hangs: Hangs | null,
) => {
  const edges: Edge[] = []
  let precedingEnd = 0
  for (let position = 0; position < items.length; position += 1) {
    const item = items[position] as Item
    const penalty = breakPenalty(items, position)
    if (penalty !== null) {
      const sourceEnd =
        item.kind === "discretionary"
          ? item.breakOffset
          : (item.source?.start ?? precedingEnd)
      edges.push(endpointAt(items, sums, hangs, position, penalty, sourceEnd))
    }
    precedingEnd = item.source?.end ?? precedingEnd
  }
  boundFutureWidths(edges, sums.corrections.shrink)
  return edges
}
