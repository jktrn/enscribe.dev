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
import { INFINITE_BADNESS, type LayoutPolicy, resolvePolicy } from "./policy"

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
}

export type PassOptions = {
  readonly tolerance: number
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number
  readonly force?: boolean
}

type ActiveNode = {
  readonly position: number
  readonly start: number
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

const sumsCache = new WeakMap<readonly Item[], Sums>()

const prefixSums = (items: readonly Item[]): Sums => {
  const cached = sumsCache.get(items)
  if (cached) return cached

  const width = [0]
  const stretch = [0]
  const shrink = [0]
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as Item
    width.push((width[index] as number) + passThroughWidth(item))
    stretch.push(
      (stretch[index] as number) + (item.kind === "glue" ? item.stretch : 0),
    )
    shrink.push(
      (shrink[index] as number) + (item.kind === "glue" ? item.shrink : 0),
    )
  }
  const sums = { width, stretch, shrink }
  sumsCache.set(items, sums)
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

const breakKindAt = (items: readonly Item[], position: number): BreakKind => {
  const item = items[position]
  if (drawsHyphen(item)) return "hyphen"
  if (isRenderedSpace(item)) return "space"
  if (item?.kind === "penalty" && isForced(item.penalty)) {
    return isParagraphEnd(items, position) ? "end" : "forced"
  }
  const limit = lineStart(items, position)
  for (let index = position + 1; index < limit; index += 1) {
    if (isRenderedSpace(items[index])) return "space"
  }
  return "none"
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
  readonly actives: ActiveNode[]
  readonly admitted: Array<ActiveNode | null>
  readonly minimum: number
  readonly rescue: Rescue | null
}

type Edge = {
  readonly width: number
  readonly stretch: number
  readonly shrink: number
  readonly trailing: number
}

const edgeAt = (search: Search, to: number): Edge => {
  const { items, sums } = search
  const endItem = items[to]
  return {
    width: sums.width[to] as number,
    stretch: sums.stretch[to] as number,
    shrink: sums.shrink[to] as number,
    trailing: endItem ? lineEndWidth(endItem) : 0,
  }
}

const leadingWidth = (items: readonly Item[], from: ActiveNode) => {
  const previousItem = from.position < 0 ? undefined : items[from.position]
  return previousItem ? lineStartWidth(previousItem) : 0
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
  leadingWidth(search.items, from) +
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

const stepTo = (
  search: Search,
  actives: readonly ActiveNode[],
  to: number,
  penaltyValue: number,
  forced: boolean,
): Step => {
  const { items, toleranceRatio, policy } = search
  const admitted: Array<ActiveNode | null> = [null, null, null, null]
  const survivors: ActiveNode[] = []
  const kind = breakKindAt(items, to)
  const edge = edgeAt(search, to)
  const startAfter = lineStart(items, to)
  const flaggedHere = isFlaggedBreak(items[to])
  const atParagraphEnd = isParagraphEnd(items, to)
  let minimum = Number.POSITIVE_INFINITY
  let rescue: Rescue | null = null

  for (const active of actives) {
    if (active.start >= to) {
      if (!forced) {
        survivors.push(active)
        continue
      }
      const demerits = active.demerits + lineDemerits(0, penaltyValue, policy)
      if (demerits < (admitted[1]?.demerits ?? Number.POSITIVE_INFINITY)) {
        admitted[1] = {
          position: to,
          start: startAfter,
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
    if (!tooLong && !forced) survivors.push(active)

    const overfull = tooLong ? 1 : 0
    const excess = tooLong
      ? overflowOf(natural, search.target)
      : Math.max(0, ratio - toleranceRatio)
    if (rescue === null) {
      rescue = { node: active, ratio, overfull, excess }
    } else if (betterRescue(overfull, excess, active, rescue)) {
      rescue.node = active
      rescue.ratio = ratio
      rescue.overfull = overfull
      rescue.excess = excess
    }

    if (!admissible(ratio, toleranceRatio)) continue

    const fitness = fitnessClass(ratio)
    let demerits = active.demerits + lineDemerits(ratio, penaltyValue, policy)

    if (active.position >= 0 && isFlaggedBreak(items[active.position])) {
      if (flaggedHere) demerits += policy.doubleHyphenDemerits
      else if (atParagraphEnd) demerits += policy.finalHyphenDemerits
    }
    if (Math.abs(fitness - active.fitness) > 1) {
      demerits += policy.adjDemerits
    }

    if (demerits < (admitted[fitness]?.demerits ?? Number.POSITIVE_INFINITY)) {
      admitted[fitness] = {
        position: to,
        start: startAfter,
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

  return { actives: survivors, admitted, minimum, rescue }
}

const forcedNode = (
  items: readonly Item[],
  rescue: Rescue,
  to: number,
): ActiveNode => {
  const ratio = Number.isFinite(rescue.ratio) ? rescue.ratio : -1
  return {
    position: to,
    start: lineStart(items, to),
    line: rescue.node.line + 1,
    fitness: fitnessClass(ratio),
    demerits: rescue.node.demerits,
    previous: rescue.node,
    ratio,
    breakKind: breakKindAt(items, to),
  }
}

const linesFrom = (search: Search, final: ActiveNode): Line[] => {
  const { items } = search
  const lines: Line[] = []
  for (
    let node: ActiveNode | null = final;
    node?.previous;
    node = node.previous
  ) {
    const from = node.previous
    const start = Math.min(from.start, node.position)
    const empty = start >= node.position
    const { natural, stretch, shrink } = empty
      ? { natural: 0, stretch: 0, shrink: 0 }
      : measureLine(search, from, edgeAt(search, node.position))
    const breakItem = items[node.position]

    const sourceEnd =
      breakItem?.kind === "discretionary"
        ? breakItem.breakOffset
        : (breakItem?.source?.start ?? items.at(-1)?.source?.end ?? 0)

    let spaceCount = 0
    for (let index = start; index < node.position; index += 1) {
      if (isRenderedSpace(items[index])) spaceCount += 1
    }

    lines.push({
      start,
      end: node.position,
      sourceStart: items[start]?.source?.start ?? sourceEnd,
      sourceEnd,
      naturalWidth: natural,
      spaceCount,
      stretch,
      shrink,
      adjustmentRatio: node.ratio,
      breakKind: node.breakKind,
    })
  }
  return lines.reverse()
}

export const breakParagraphOnce = (
  items: readonly Item[],
  measure: number,
  options: PassOptions,
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }

  const policy = resolvePolicy(options.policy)
  const search: Search = {
    items,
    sums: prefixSums(items),
    target: measure,
    toleranceRatio: maximumRatio(options.tolerance),
    emergencyStretch: options.emergencyStretch ?? 0,
    policy,
  }

  let actives: ActiveNode[] = [
    {
      position: -1,
      start: lineStart(items, -1),
      line: 0,
      fitness: 1,
      demerits: 0,
      previous: null,
      ratio: 0,
      breakKind: "none",
    },
  ]

  for (let to = 0; to < items.length; to += 1) {
    const penaltyValue = breakPenalty(items, to)
    if (penaltyValue === null) continue
    const forced = isForced(penaltyValue)
    const step = stepTo(search, actives, to, penaltyValue, forced)
    actives = step.actives

    if (step.minimum === Number.POSITIVE_INFINITY) {
      if (actives.length > 0) continue
      if (!options.force || !step.rescue)
        return { ok: false, reason: "infeasible" }
      actives = [forcedNode(items, step.rescue, to)]
      continue
    }

    const ceiling = step.minimum + Math.abs(policy.adjDemerits)
    for (let fitness = 0; fitness < 4; fitness += 1) {
      const candidate = step.admitted[fitness]
      if (candidate && candidate.demerits <= ceiling) actives.push(candidate)
    }
  }

  const final = actives.reduce<ActiveNode | null>(
    (best, node) => (!best || node.demerits < best.demerits ? node : best),
    null,
  )
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

export const breakParagraph = (
  items: readonly Item[],
  measure: number,
  options: LayoutOptions = {},
): LayoutResult => {
  if (items.length === 0) return { ok: false, reason: "empty" }
  const policy = resolvePolicy(options.policy)
  const shared = { policy: options.policy }

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

  const emergencyStretch =
    options.emergencyStretch === undefined ||
    options.emergencyStretch === "auto"
      ? meanGlueWidth(items) * EMERGENCY_STRETCH_SPACES
      : options.emergencyStretch

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
