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
  passThroughWidth,
} from "./items"
import type { Flex } from "./flex"
import { INFINITE_BADNESS, type LayoutPolicy, resolvePolicy } from "./policy"
import type { Hangs } from "./protrusion"

export type BreakKind = "space" | "hyphen" | "forced" | "none" | "end"

export type Line = {
  readonly start: number
  readonly end: number
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly naturalWidth: number
  readonly spaceCount: number
  readonly stretch: number
  readonly shrink: number
  readonly adjustmentRatio: number
  readonly breakKind: BreakKind
  readonly hangStart: number
  readonly hangEnd: number
}

export type LayoutPass = "pretolerance" | "tolerance" | "emergency" | "forced"

export type LayoutResult =
  | {
      readonly ok: true
      readonly lines: readonly Line[]
      readonly pass: LayoutPass
      readonly demerits: number
    }
  | { readonly ok: false; readonly reason: "empty" | "infeasible" }

export type LayoutOptions = {
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number | "auto"
  readonly hangs?: Hangs
  readonly flex?: Flex
}

export type PassOptions = {
  readonly tolerance: number
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number
  readonly force?: boolean
  readonly hangs?: Hangs
  readonly flex?: Flex
}

type ActiveNode = {
  readonly position: number
  readonly start: number
  readonly leading: number
  readonly flagged: boolean
  readonly line: number
  readonly fitness: number
  readonly demerits: number
  readonly previous: ActiveNode | null
  readonly ratio: number
  readonly breakKind: BreakKind
}

type Sums = {
  readonly width: readonly number[]
  readonly stretch: readonly number[]
  readonly shrink: readonly number[]
}

type Cached = {
  readonly flex: Flex | undefined
  readonly sums: Sums
}

const sumsCache = new WeakMap<readonly Item[], Cached>()

const plainSums = (items: readonly Item[]): Sums => {
  const count = items.length
  const width = new Array<number>(count + 1)
  const stretch = new Array<number>(count + 1)
  const shrink = new Array<number>(count + 1)
  width[0] = 0
  stretch[0] = 0
  shrink[0] = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const glue = item.kind === "glue"
    width[index + 1] = (width[index] as number) + passThroughWidth(item)
    stretch[index + 1] = (stretch[index] as number) + (glue ? item.stretch : 0)
    shrink[index + 1] = (shrink[index] as number) + (glue ? item.shrink : 0)
  }
  return { width, stretch, shrink }
}

const flexedSums = (items: readonly Item[], flex: Flex): Sums => {
  const { stretch: up, shrink: down } = flex
  const count = items.length
  const width = new Array<number>(count + 1)
  const stretch = new Array<number>(count + 1)
  const shrink = new Array<number>(count + 1)
  width[0] = 0
  stretch[0] = 0
  shrink[0] = 0
  for (let index = 0; index < count; index += 1) {
    const item = items[index] as Item
    const glue = item.kind === "glue"
    width[index + 1] = (width[index] as number) + passThroughWidth(item)
    stretch[index + 1] =
      (stretch[index] as number) +
      (glue ? item.stretch : 0) +
      ((up[index + 1] as number) - (up[index] as number))
    shrink[index + 1] =
      (shrink[index] as number) +
      (glue ? item.shrink : 0) +
      ((down[index + 1] as number) - (down[index] as number))
  }
  return { width, stretch, shrink }
}

const prefixSums = (items: readonly Item[], flex: Flex | undefined): Sums => {
  const cached = sumsCache.get(items)
  if (cached && cached.flex === flex) return cached.sums

  const sums = flex ? flexedSums(items, flex) : plainSums(items)
  sumsCache.set(items, { flex, sums })
  return sums
}

const fitnessClass = (ratio: number) => {
  if (ratio < -0.5) return 0
  if (ratio < 0.5) return 1
  if (ratio < 1) return 2
  return 3
}

const badness = (ratio: number) => 100 * Math.abs(ratio) ** 3

const lineDemerits = (
  ratio: number,
  penaltyValue: number,
  policy: LayoutPolicy,
) => {
  const base = policy.linePenalty + badness(ratio)
  const squared = Math.abs(base) >= 10_000 ? 100_000_000 : base ** 2
  if (penaltyValue > 0) return squared + penaltyValue ** 2
  if (isForced(penaltyValue)) return squared
  if (penaltyValue < 0) return squared - penaltyValue ** 2
  return squared
}

const lineStart = (items: readonly Item[], position: number) => {
  if (position >= 0 && items[position]?.kind === "discretionary") {
    return position + 1
  }

  let index = position + 1
  while (index < items.length) {
    const item = items[index] as Item
    if (item.kind === "box" || item.kind === "discretionary") break
    index += 1
  }
  return index
}

const hasRenderedSpace = (items: readonly Item[], from: number, to: number) => {
  for (let index = from; index < to; index += 1) {
    if (isRenderedSpace(items[index])) return true
  }
  return false
}

const breakKindAt = (items: readonly Item[], position: number): BreakKind => {
  const item = items[position]
  if (drawsHyphen(item)) return "hyphen"
  if (isRenderedSpace(item)) return "space"
  if (item?.kind === "penalty" && isForced(item.penalty)) {
    return isParagraphEnd(items, position) ? "end" : "forced"
  }
  const limit = lineStart(items, position)
  return hasRenderedSpace(items, position + 1, limit) ? "space" : "none"
}

const maximumRatio = (tolerance: number) =>
  tolerance < 0 ? -1 : (tolerance / 100) ** (1 / 3)

const INFINITE_BADNESS_RATIO = maximumRatio(INFINITE_BADNESS)

const admissible = (ratio: number, toleranceRatio: number) =>
  ratio >= -1 && Math.min(ratio, INFINITE_BADNESS_RATIO) <= toleranceRatio

const overflowOf = (natural: number, target: number) =>
  Number.isFinite(natural) ? natural - target : Number.POSITIVE_INFINITY

type Search = {
  readonly items: readonly Item[]
  readonly sums: Sums
  readonly target: number
  readonly toleranceRatio: number
  readonly emergencyStretch: number
  readonly policy: LayoutPolicy
  readonly rescuing: boolean
  readonly hangs: Hangs | null
}

type Rescue = {
  node: ActiveNode
  ratio: number
  overfull: number
  excess: number
}

const betterRescue = (
  overfull: number,
  excess: number,
  active: ActiveNode,
  current: Rescue,
) => {
  if (overfull !== current.overfull) return overfull < current.overfull
  if (excess !== current.excess) return excess < current.excess
  if (active.position !== current.node.position) {
    return active.position > current.node.position
  }
  return active.demerits < current.node.demerits
}

type Step = {
  readonly admitted: Array<ActiveNode | null>
  minimum: number
  rescue: Rescue | null
}

const emptyStep = (): Step => ({
  admitted: [null, null, null, null],
  minimum: Number.POSITIVE_INFINITY,
  rescue: null,
})

const clearStep = (step: Step) => {
  step.admitted[0] = null
  step.admitted[1] = null
  step.admitted[2] = null
  step.admitted[3] = null
  step.rescue = null
}

const rankRescue = (
  search: Search,
  step: Step,
  active: ActiveNode,
  natural: number,
  ratio: number,
) => {
  const tooLong = ratio < -1
  const overfull = tooLong ? 1 : 0
  const excess = tooLong
    ? overflowOf(natural, search.target)
    : Math.max(0, ratio - search.toleranceRatio)
  const rescue = step.rescue
  if (rescue === null) {
    step.rescue = { node: active, ratio, overfull, excess }
    return
  }
  if (!betterRescue(overfull, excess, active, rescue)) return
  rescue.node = active
  rescue.ratio = ratio
  rescue.overfull = overfull
  rescue.excess = excess
}

type Edge = {
  readonly width: number
  readonly stretch: number
  readonly shrink: number
  readonly trailing: number
}

const edgeAt = (search: Search, to: number): Edge => {
  const { items, sums, hangs } = search
  const endItem = items[to]
  return {
    width: sums.width[to] as number,
    stretch: sums.stretch[to] as number,
    shrink: sums.shrink[to] as number,
    trailing:
      (endItem ? lineEndWidth(endItem) : 0) -
      (hangs ? (hangs.end[to] as number) : 0),
  }
}

const leadingWidth = (search: Search, position: number) => {
  const item = search.items[position]
  return (
    (item ? lineStartWidth(item) : 0) -
    (search.hangs ? (search.hangs.start[position + 1] as number) : 0)
  )
}

const adjustmentRatio = (
  search: Search,
  natural: number,
  stretch: number,
  shrink: number,
) => {
  if (!Number.isFinite(natural)) return Number.NEGATIVE_INFINITY
  const slack = search.target - natural
  let ratio = 0
  if (slack > 0) {
    const stretchable = stretch + search.emergencyStretch
    ratio = stretchable > 0 ? slack / stretchable : INFINITE_BADNESS_RATIO
  }
  if (slack < 0) ratio = shrink > 0 ? slack / shrink : Number.NEGATIVE_INFINITY
  return ratio
}

const naturalWidth = (search: Search, from: ActiveNode, edge: Edge) =>
  edge.width -
  (search.sums.width[from.start] as number) +
  from.leading +
  edge.trailing

const stretchOf = (search: Search, from: ActiveNode, edge: Edge) =>
  edge.stretch - (search.sums.stretch[from.start] as number)

const shrinkOf = (search: Search, from: ActiveNode, edge: Edge) =>
  edge.shrink - (search.sums.shrink[from.start] as number)

const measureLine = (search: Search, from: ActiveNode, edge: Edge) => {
  const natural = naturalWidth(search, from, edge)
  const stretch = stretchOf(search, from, edge)
  const shrink = shrinkOf(search, from, edge)
  return {
    natural: Number.isFinite(natural) ? natural : Number.NaN,
    ratio: adjustmentRatio(search, natural, stretch, shrink),
    stretch,
    shrink,
  }
}

const flaggedDemeritsAt = (
  items: readonly Item[],
  to: number,
  flaggedHere: boolean,
  policy: LayoutPolicy,
) => {
  if (flaggedHere) return policy.doubleHyphenDemerits
  if (isParagraphEnd(items, to)) return policy.finalHyphenDemerits
  return 0
}

const stepTo = (
  search: Search,
  actives: ActiveNode[],
  step: Step,
  to: number,
  penaltyValue: number,
) => {
  const { items, toleranceRatio, policy } = search
  const forced = isForced(penaltyValue)
  clearStep(step)
  const admitted = step.admitted
  let kept = 0
  const kind = breakKindAt(items, to)
  const edge = edgeAt(search, to)
  const startAfter = lineStart(items, to)
  const leadingAfter = leadingWidth(search, to)
  const flaggedHere = isFlaggedBreak(items[to])
  const flaggedExtra = flaggedDemeritsAt(items, to, flaggedHere, policy)
  const emptyDemerits = forced ? lineDemerits(0, penaltyValue, policy) : 0
  let minimum = Number.POSITIVE_INFINITY

  for (let index = 0; index < actives.length; index += 1) {
    const active = actives[index] as ActiveNode
    if (active.start >= to) {
      if (!forced) {
        actives[kept] = active
        kept += 1
        continue
      }
      const demerits = active.demerits + emptyDemerits
      if (demerits < (admitted[1]?.demerits ?? Number.POSITIVE_INFINITY)) {
        admitted[1] = {
          position: to,
          start: startAfter,
          leading: leadingAfter,
          flagged: flaggedHere,
          line: active.line + 1,
          fitness: 1,
          demerits,
          previous: active,
          ratio: 0,
          breakKind: kind,
        }
        if (demerits < minimum) minimum = demerits
      }
      continue
    }

    const natural = naturalWidth(search, active, edge)
    const ratio = adjustmentRatio(
      search,
      natural,
      stretchOf(search, active, edge),
      shrinkOf(search, active, edge),
    )

    const tooLong = ratio < -1
    if (!tooLong && !forced) {
      actives[kept] = active
      kept += 1
    }

    if (search.rescuing) rankRescue(search, step, active, natural, ratio)

    if (!admissible(ratio, toleranceRatio)) continue

    const fitness = fitnessClass(ratio)
    let demerits = active.demerits + lineDemerits(ratio, penaltyValue, policy)

    if (active.flagged) demerits += flaggedExtra
    if (Math.abs(fitness - active.fitness) > 1) {
      demerits += policy.adjDemerits
    }

    if (demerits < (admitted[fitness]?.demerits ?? Number.POSITIVE_INFINITY)) {
      admitted[fitness] = {
        position: to,
        start: startAfter,
        leading: leadingAfter,
        flagged: flaggedHere,
        line: active.line + 1,
        fitness,
        demerits,
        previous: active,
        ratio,
        breakKind: kind,
      }
      if (demerits < minimum) minimum = demerits
    }
  }

  actives.length = kept
  step.minimum = minimum
}

const forcedNode = (search: Search, rescue: Rescue, to: number): ActiveNode => {
  const { items } = search
  const ratio = Number.isFinite(rescue.ratio) ? rescue.ratio : -1
  return {
    position: to,
    start: lineStart(items, to),
    leading: leadingWidth(search, to),
    flagged: isFlaggedBreak(items[to]),
    line: rescue.node.line + 1,
    fitness: fitnessClass(ratio),
    demerits: rescue.node.demerits,
    previous: rescue.node,
    ratio,
    breakKind: breakKindAt(items, to),
  }
}

const EMPTY_MEASURE = { natural: 0, stretch: 0, shrink: 0 }

const sourceEndAt = (items: readonly Item[], position: number) => {
  const breakItem = items[position]
  if (breakItem?.kind === "discretionary") return breakItem.breakOffset
  return breakItem?.source?.start ?? items.at(-1)?.source?.end ?? 0
}

const spacesBetween = (items: readonly Item[], from: number, to: number) => {
  let spaceCount = 0
  for (let index = from; index < to; index += 1) {
    if (isRenderedSpace(items[index])) spaceCount += 1
  }
  return spaceCount
}

const lineTo = (search: Search, from: ActiveNode, node: ActiveNode): Line => {
  const { items } = search
  const start = Math.min(from.start, node.position)
  const empty = start >= node.position
  const { natural, stretch, shrink } = empty
    ? EMPTY_MEASURE
    : measureLine(search, from, edgeAt(search, node.position))
  const sourceEnd = sourceEndAt(items, node.position)
  const hangs = empty ? null : search.hangs

  return {
    start,
    end: node.position,
    sourceStart: items[start]?.source?.start ?? sourceEnd,
    sourceEnd,
    naturalWidth: natural,
    spaceCount: spacesBetween(items, start, node.position),
    stretch,
    shrink,
    adjustmentRatio: node.ratio,
    breakKind: node.breakKind,
    hangStart: hangs ? (hangs.start[from.position + 1] as number) : 0,
    hangEnd: hangs ? (hangs.end[node.position] as number) : 0,
  }
}

const linesFrom = (search: Search, final: ActiveNode): Line[] => {
  const lines: Line[] = []
  for (
    let node: ActiveNode | null = final;
    node?.previous;
    node = node.previous
  ) {
    lines.push(lineTo(search, node.previous, node))
  }
  return lines.reverse()
}

const searchFor = (
  items: readonly Item[],
  measure: number,
  options: PassOptions,
): Search => ({
  items,
  sums: prefixSums(items, options.flex),
  target: measure,
  toleranceRatio: maximumRatio(options.tolerance),
  emergencyStretch: options.emergencyStretch ?? 0,
  policy: resolvePolicy(options.policy),
  rescuing: options.force === true,
  hangs: options.hangs ?? null,
})

const initialNode = (search: Search): ActiveNode => ({
  position: -1,
  start: lineStart(search.items, -1),
  leading: leadingWidth(search, -1),
  flagged: false,
  line: 0,
  fitness: 1,
  demerits: 0,
  previous: null,
  ratio: 0,
  breakKind: "none",
})

const admitCandidates = (
  actives: ActiveNode[],
  step: Step,
  adjDemerits: number,
) => {
  const ceiling = step.minimum + Math.abs(adjDemerits)
  for (let fitness = 0; fitness < 4; fitness += 1) {
    const candidate = step.admitted[fitness]
    if (candidate && candidate.demerits <= ceiling) actives.push(candidate)
  }
}

const afterStep = (
  search: Search,
  actives: ActiveNode[],
  step: Step,
  to: number,
  force: boolean,
): ActiveNode[] | null => {
  if (step.minimum !== Number.POSITIVE_INFINITY) {
    admitCandidates(actives, step, search.policy.adjDemerits)
    return actives
  }
  if (actives.length > 0) return actives
  if (!force || !step.rescue) return null
  return [forcedNode(search, step.rescue, to)]
}

const runSearch = (search: Search, force: boolean): ActiveNode[] | null => {
  const { items } = search
  let actives: ActiveNode[] = [initialNode(search)]
  const step = emptyStep()

  for (let to = 0; to < items.length; to += 1) {
    const penaltyValue = breakPenalty(items, to)
    if (penaltyValue === null) continue

    stepTo(search, actives, step, to, penaltyValue)
    const next = afterStep(search, actives, step, to, force)
    if (!next) return null
    actives = next
  }
  return actives
}

const bestNode = (actives: readonly ActiveNode[]) => {
  let best: ActiveNode | null = null
  for (const node of actives) {
    if (!best || node.demerits < best.demerits) best = node
  }
  return best
}

export const breakParagraphOnce = (
  items: readonly Item[],
  measure: number,
  options: PassOptions,
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }

  const search = searchFor(items, measure, options)
  const actives = runSearch(search, options.force === true)
  if (!actives) return { ok: false, reason: "infeasible" }

  const final = bestNode(actives)
  if (!final || final.line === 0) return { ok: false, reason: "infeasible" }
  return {
    ok: true,
    lines: linesFrom(search, final),
    pass: options.force ? "forced" : "tolerance",
    demerits: final.demerits,
  }
}

const meanGlueWidth = (items: readonly Item[]) => {
  let total = 0
  let count = 0
  for (const item of items) {
    if (item.kind === "glue" && item.width > 0) {
      total += item.width
      count += 1
    }
  }
  return count > 0 ? total / count : 0
}

const EMERGENCY_STRETCH_SPACES = 14

const emergencyStretchFor = (
  items: readonly Item[],
  requested: LayoutOptions["emergencyStretch"],
) => {
  if (requested === undefined || requested === "auto") {
    return meanGlueWidth(items) * EMERGENCY_STRETCH_SPACES
  }
  return requested
}

export const breakParagraph = (
  items: readonly Item[],
  measure: number,
  options: LayoutOptions = {},
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }
  const policy = resolvePolicy(options.policy)
  const shared = {
    policy: options.policy,
    hangs: options.hangs,
    flex: options.flex,
  }

  if (policy.pretolerance >= 0) {
    const strict = breakParagraphOnce(items, measure, {
      ...shared,
      tolerance: policy.pretolerance,
    })
    if (strict.ok) return { ...strict, pass: "pretolerance" }
  }

  const relaxed = breakParagraphOnce(items, measure, {
    ...shared,
    tolerance: policy.tolerance,
  })
  if (relaxed.ok) return { ...relaxed, pass: "tolerance" }

  const emergencyStretch = emergencyStretchFor(items, options.emergencyStretch)

  if (emergencyStretch > 0) {
    const emergency = breakParagraphOnce(items, measure, {
      ...shared,
      tolerance: policy.tolerance,
      emergencyStretch,
    })
    if (emergency.ok) return { ...emergency, pass: "emergency" }
  }

  return breakParagraphOnce(items, measure, {
    ...shared,
    tolerance: INFINITE_BADNESS,
    emergencyStretch,
    force: true,
  })
}
