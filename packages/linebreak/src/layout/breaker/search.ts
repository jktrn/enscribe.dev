import { runSimpleSearch } from "./simple-search"
import { newSum } from "../numeric/sum"
import { badnessOf, fitnessOf } from "./cost"
import { integerFitness } from "./integer"
import { canContinue } from "./geometry"
import { rangeDifference, rangeSum } from "../numeric/range"
import { INFINITE_BADNESS_RATIO } from "./cost"
import type { ActiveNode, Boundary, Edge, Measurement, Search } from "./types"

type Rescue = {
  previous: ActiveNode | null
  ratio: number
  overfull: boolean
  excess: number
  fitness: number
}
type Step = {
  previous: Array<ActiveNode | null>
  costs: number[]
  ratios: number[]
  minimum: number
  candidates: number
  rescue: Rescue
  measured: Measurement
  validCapacities: boolean
  lineCost: number | null
  fitness: number
  alternatives: Array<Map<number, ActiveNode>> | null
}

const FITNESS_CLASSES = [0, 1, 2, 3] as const

const newStep = (search: Search): Step => ({
  previous: new Array<ActiveNode | null>(FITNESS_CLASSES.length),
  costs: new Array<number>(FITNESS_CLASSES.length),
  ratios: new Array<number>(FITNESS_CLASSES.length),
  minimum: Number.POSITIVE_INFINITY,
  candidates: 0,
  // clearStep and measureInto initialize scratch fields before any read.
  rescue: {} as Rescue,
  measured: { sum: newSum(search.diagnostics) } as Measurement,
  validCapacities: false,
  lineCost: null,
  fitness: 1,
  alternatives:
    search.demeritBound !== null ? null : FITNESS_CLASSES.map(() => new Map()),
})

const clearStep = (step: Step) => {
  step.candidates = 0
  step.minimum = Number.POSITIVE_INFINITY
  step.rescue.previous = null
  if (step.alternatives) for (const costs of step.alternatives) costs.clear()
}

const initialNode = (search: Search): ActiveNode => ({
  boundary: search.opening,
  leading: search.opening.leading + search.indent,
  fitness: 1,
  demerits: 0,
  previous: null,
  ratio: 0,
})

const betterRescue = (
  overfull: boolean,
  excess: number,
  from: ActiveNode,
  current: Rescue,
) => {
  if (!current.previous) return true
  if (overfull !== current.overfull) return !overfull
  if (excess > current.excess) return false
  if (from.boundary.position > current.previous.boundary.position) return true
  // Equal endpoints have identical geometry. Smaller excess therefore
  // belongs to a later endpoint in this nondecreasing visit order.
  return from.demerits < current.previous.demerits
}

const rankRescue = (search: Search, step: Step, previous: ActiveNode) => {
  const { ratio, natural } = step.measured
  if (!Number.isFinite(natural)) return
  const overfull = ratio < -1
  const excess = overfull
    ? natural - search.target
    : Math.max(0, Math.abs(ratio) - Math.cbrt(search.tolerance / 100))
  const finiteExcess = Number.isFinite(excess)
    ? excess
    : Number.POSITIVE_INFINITY
  if (!betterRescue(overfull, finiteExcess, previous, step.rescue)) return
  step.rescue.previous = previous
  step.rescue.ratio = ratio
  step.rescue.overfull = overfull
  step.rescue.excess = finiteExcess
  const renderRatio = Number.isFinite(ratio) ? ratio : -1
  step.rescue.fitness = fitnessOf(
    search,
    renderRatio,
    badnessOf(search, step.measured),
  )
}





const nodeAt = (
  edge: Edge,
  previous: ActiveNode,
  ratio: number,
  demerits: number,
  fitness: number,
): ActiveNode => ({
  boundary: edge,
  leading: edge.leading,
  fitness,
  previous,
  ratio,
  demerits,
})

const admitCandidates = (
  search: Search,
  actives: ActiveNode[],
  step: Step,
  edge: Edge,
) => {
  if (step.alternatives) {
    for (const costs of step.alternatives)
      for (const candidate of costs.values()) actives.push(candidate)
    return
  }
  if (step.minimum === Number.POSITIVE_INFINITY) return
  // The same future line can round differently before and after adding a
  // fitness charge. The whole-path bound covers both additions and the
  // rounded ceiling; see the finite-cost proof in algorithm-audit.md.
  const roundoff = (search.demeritBound as number) * (64 * Number.EPSILON)
  const ceiling = step.minimum + Math.abs(search.policy.adjDemerits) + roundoff
  let candidates = step.candidates
  while (candidates !== 0) {
    const bit = candidates & -candidates
    const fitness = 31 - Math.clz32(bit)
    candidates ^= bit
    const previous = step.previous[fitness]
    const demerits = step.costs[fitness] as number
    if (previous && demerits <= ceiling) {
      actives.push(
        nodeAt(
          edge,
          previous,
          step.ratios[fitness] as number,
          demerits,
          fitness,
        ),
      )
    }
  }
}

const canBreakFrom = (search: Search, active: ActiveNode, edge: Edge) => {
  if (active.boundary.start < edge.position || edge.forced) return true
  if (active.boundary.start > edge.position) return false
  return (
    edge.trailing !== 0 ||
    active.boundary.leading !== 0 ||
    (active.previous === null && search.indent !== 0)
  )
}


export const runSearch = (search: Search): ActiveNode | null => {
  if (!search.validCapacities) return null
  const final = search.edges.at(-1)
  if (!final?.forced || final.position !== search.itemCount - 1) return null
  if (search.simple && search.boundedCapacities && search.demeritBound !== null &&
      !search.diagnostics && !search.rescuing && search.indent === 0 &&
      search.ending === 0 && search.emergencyStretch === 0)
    return runSimpleSearch(search)
  const actives = [initialNode(search)]
  const step = newStep(search)
  const { diagnostics } = search
  if (diagnostics) diagnostics.peakActiveNodes = 1
  for (const edge of search.edges) {
  clearStep(step)
  const target = search.target
  const policy = search.policy
  const integer = policy.scoring === "integer"
  let natural = 0, stretch = 0, shrink = 0, ratio = 0
  let validCapacities = false, lineCost: number | null = null, fitness = 1
  let kept = 0
  let boundary: Boundary | null = null
  let eligible = false
  let continues = true
  for (const active of actives) {
    if (active.boundary !== boundary) {
      boundary = active.boundary
      eligible = canBreakFrom(search, active, edge)
      continues = true
      if (eligible) {

        const measured = step.measured
        const opening = active.boundary
        measurement: {
          if (opening.start === edge.position && opening.leading === 0 &&
              !(active.previous === null && search.indent !== 0) && edge.trailing === 0) {
            natural = 0
            stretch = 0
            shrink = 0
            ratio = 0
            break measurement
          }
          const correction = search.corrections.width
          if (active.leading === 0 && edge.trailing === 0 && opening.hangStart === 0 && edge.hangEnd === 0) {
            natural = correction ? rangeDifference(measured.sum, correction,
              opening.start, edge.position, opening.startWidth, edge.width) : edge.width - opening.startWidth
          } else {
            natural = rangeSum(measured.sum, correction, opening.start, edge.position,
              opening.startWidth, edge.width, active.leading, edge.trailing, -opening.hangStart, -edge.hangEnd)
          }
          stretch = 0
          shrink = 0
          if (!search.boundedCapacities || natural < target) {
            const correction = search.corrections.stretch
            stretch = correction ? rangeDifference(measured.sum, correction,
              opening.start, edge.position, opening.startStretch, edge.stretch) : edge.stretch - opening.startStretch
          }
          if (!search.boundedCapacities || natural > target) {
            const correction = search.corrections.shrink
            shrink = correction ? rangeDifference(measured.sum, correction,
              opening.start, edge.position, opening.startShrink, edge.shrink) : edge.shrink - opening.startShrink
          }
          const slack = target - natural
          if (!Number.isFinite(natural)) ratio = Number.NEGATIVE_INFINITY
          else if (slack < 0) ratio = slack / Math.max(0, shrink)
          else if (slack === 0) ratio = 0
          else {
            const stretchable = stretch + search.emergencyStretch
            if (!(stretchable > 0)) ratio = INFINITE_BADNESS_RATIO
            else if (slack === Number.POSITIVE_INFINITY || stretchable === Number.POSITIVE_INFINITY)
              ratio = (target / 2 - natural / 2) / (stretch / 2 + search.emergencyStretch / 2)
            else ratio = slack / stretchable
          }
        }
        validCapacities = search.boundedCapacities ||
          (Number.isFinite(stretch) && Number.isFinite(shrink))
        lineCost = null
        admission: {
          if (!validCapacities || ratio < -1 || ratio > search.rejectionRatio) break admission
          const ending = edge.final ? search.ending : 0
          if (search.endingStrict && ending > 0 && ending > natural) break admission
          if (search.diagnostics) search.diagnostics.evaluatedBadness = (search.diagnostics.evaluatedBadness as number) + 1
          let badness = Math.min(10000, 100 * Math.abs(ratio * ratio * ratio))
          if (integer) {
            badness = 0
            if (ratio !== 0) {
              const capacity = ratio < 0 ? shrink : stretch + search.emergencyStretch
              badness = 10000
              if (capacity > 0) {
                const scaled = 297 * Math.abs(target - natural)
                const value = Math.floor(Number.isFinite(scaled) && Number.isFinite(capacity) ? scaled / capacity : 297 * Math.abs(ratio))
                if (!(value > 1290)) badness = Math.floor((value ** 3 + 131072) / 262144)
              }
            }
          }
          if (!(badness <= search.tolerance)) break admission
          const endingCost = ending > 0 ? 200 * (Math.max(0, ending - natural) / ending) ** 3 : 0
          const base = policy.linePenalty + badness + endingCost
          lineCost = Math.min(100000000, base ** 2) + edge.penaltyCost
          if (opening.flagged) lineCost += edge.flagged ? policy.doubleHyphenDemerits : edge.final ? policy.finalHyphenDemerits : 0
          fitness = integer ? integerFitness(ratio, badness) : ratio < -0.5 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3
        }
        continues = !edge.forced &&
          (!(ratio < -1) || canContinue(search, active, edge))
      }
    }
    if (eligible) consideration: {
  const measured = step.measured
  if (search.diagnostics) search.diagnostics.evaluatedLines += 1
  if (!validCapacities) break consideration
  if (search.rescuing) {
    measured.natural = natural
    measured.stretch = stretch
    measured.shrink = shrink
    measured.ratio = ratio
    rankRescue(search, step, active)
  }
  if (lineCost === null) break consideration
  let cost = lineCost
  if (Math.abs(fitness - active.fitness) > 1) cost += search.policy.adjDemerits
  const demerits = active.demerits + cost
  if (step.alternatives) {
    if (!Number.isFinite(demerits)) break consideration
    const costs = step.alternatives[fitness] as Map<number, ActiveNode>
    if (!costs.has(demerits))
      costs.set(demerits, nodeAt(edge, active, ratio, demerits, fitness))
    break consideration
  }
  const bit = 1 << fitness
  if (!(step.candidates & bit) || demerits < (step.costs[fitness] as number)) {
    step.candidates |= bit
    step.previous[fitness] = active
    step.ratios[fitness] = ratio
    step.costs[fitness] = demerits
    step.minimum = Math.min(step.minimum, demerits)
  }

    }
    if (continues) actives[kept++] = active
  }
  actives.length = kept
  admitCandidates(search, actives, step, edge)
  const { rescue } = step
  if (actives.length === 0 && rescue.previous) {
    const ratio = Number.isFinite(rescue.ratio) ? rescue.ratio : -1
    actives.push(
      nodeAt(
        edge,
        rescue.previous,
        ratio,
        rescue.previous.demerits,
        rescue.fitness,
      ),
    )
  }
    if (diagnostics) {
      diagnostics.processedBreakpoints =
        (diagnostics.processedBreakpoints as number) + 1
      diagnostics.peakActiveNodes = Math.max(
        diagnostics.peakActiveNodes,
        actives.length,
      )
    }
    if (actives.length === 0) return null
  }
  let best: ActiveNode | null = null
  for (const active of actives) {
    if (!best || active.demerits < best.demerits) best = active
  }
  return best
}
