import { FORBIDDEN_PENALTY, FORCED_PENALTY, INFINITE_STRETCH } from "../policy"

export type ItemSource = { readonly start: number; readonly end: number }

export type Box = {
  readonly kind: "box"
  readonly width: number
  readonly source: ItemSource
}

export type Glue = {
  readonly kind: "glue"
  readonly width: number
  readonly stretch: number
  readonly shrink: number
  readonly source: ItemSource
}

export type Penalty = {
  readonly kind: "penalty"
  readonly width: number
  readonly penalty: number
  readonly flagged: boolean
  readonly source: ItemSource
}

export type Discretionary = {
  readonly kind: "discretionary"
  readonly preWidth: number
  readonly postWidth: number
  readonly noBreakWidth: number
  readonly penalty: number
  readonly hyphen: boolean
  readonly source: ItemSource
  readonly breakOffset: number
}

export type Item = Box | Glue | Penalty | Discretionary

export const isForbidden = (penalty: number) => penalty >= FORBIDDEN_PENALTY

export const isForced = (penalty: number) => penalty <= FORCED_PENALTY

export const passThroughWidth = (item: Item): number => {
  switch (item.kind) {
    case "box":
      return item.width
    case "glue":
      return item.width
    case "penalty":
      return 0
    case "discretionary":
      return item.noBreakWidth
  }
}

export const lineEndWidth = (item: Item): number => {
  switch (item.kind) {
    case "penalty":
      return item.width
    case "discretionary":
      return item.preWidth
    default:
      return 0
  }
}

export const lineStartWidth = (item: Item): number =>
  item.kind === "discretionary" ? item.postWidth : 0

export const breakPenalty = (items: readonly Item[], index: number) => {
  const item = items[index]
  if (!item) return null
  if (item.kind === "glue") {
    const previous = items[index - 1]
    if (!previous) return null
    if (previous.kind !== "box" && previous.kind !== "discretionary")
      return null
    return 0
  }
  if (item.kind === "penalty")
    return isForbidden(item.penalty) ? null : item.penalty
  if (item.kind === "discretionary") {
    return isForbidden(item.penalty) ? null : item.penalty
  }
  return null
}

export const drawsHyphen = (item: Item | undefined) =>
  item?.kind === "discretionary" && item.hyphen

export const isFlaggedBreak = (item: Item | undefined) =>
  item?.kind === "penalty" ? item.flagged : drawsHyphen(item)

export const isRenderedSpace = (item: Item | undefined) =>
  item?.kind === "glue" && item.source.end > item.source.start

export const forcedBreak = (offset: number, end = offset): Item[] => {
  const source = { start: offset, end: offset }
  return [
    {
      kind: "penalty",
      width: 0,
      penalty: FORBIDDEN_PENALTY,
      flagged: false,
      source,
    },
    { kind: "glue", width: 0, stretch: INFINITE_STRETCH, shrink: 0, source },
    {
      kind: "penalty",
      width: 0,
      penalty: FORCED_PENALTY,
      flagged: false,
      source: { start: offset, end },
    },
  ]
}

export const paragraphTerminator = (offset: number): Item[] =>
  forcedBreak(offset)
