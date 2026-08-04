export type StretchStep = {
  readonly pct: number
  readonly ratio: number
}

export type StretchScale = {
  readonly steps: readonly StretchStep[]
}

export type StretchProbe = (pct: number) => number

const PROBE_OFFSETS_PCT = [1, 2, 3, 4, 5, 6] as const

const MAX_STEPS_PER_SIDE = 4

const MAX_RATIO_JUMP_PER_PCT = 0.02

const BUDGET_EPSILON = 1e-12

export const narrowestRatio = (scale: StretchScale) =>
  (scale.steps[0] as StretchStep).ratio

export const widestRatio = (scale: StretchScale) =>
  (scale.steps.at(-1) as StretchStep).ratio

const misbehaves = (sign: 1 | -1, ratio: number, previous: number) => {
  if (!Number.isFinite(ratio) || ratio <= 0) return true
  if (sign * (ratio - previous) < 0) return true
  return Math.abs(ratio - previous) > MAX_RATIO_JUMP_PER_PCT
}

const recordStep = (
  steps: StretchStep[],
  step: StretchStep,
  budget: number,
  reach: number,
) => {
  if (reach > budget + BUDGET_EPSILON) return true
  if (step.ratio !== (steps.at(-1)?.ratio ?? 1)) steps.push(step)
  return reach >= budget || steps.length === MAX_STEPS_PER_SIDE
}

const sideSteps = (
  sign: 1 | -1,
  budget: number,
  base: number,
  probe: StretchProbe,
): StretchStep[] | null => {
  const steps: StretchStep[] = []
  let previous = 1
  for (const delta of PROBE_OFFSETS_PCT) {
    const pct = 100 + sign * delta
    const ratio = probe(pct) / base
    if (misbehaves(sign, ratio, previous)) return null
    previous = ratio

    if (recordStep(steps, { pct, ratio }, budget, sign * (ratio - 1))) break
  }
  return steps
}

export const calibrateStretch = (
  budget: number,
  probe: StretchProbe,
): StretchScale | null => {
  const base = probe(100)
  if (!Number.isFinite(base) || base <= 0) return null

  const narrower = sideSteps(-1, budget, base, probe)
  const wider = sideSteps(1, budget, base, probe)
  if (!narrower || !wider) return null
  if (narrower.length === 0 && wider.length === 0) return null

  return {
    steps: [...narrower.reverse(), { pct: 100, ratio: 1 }, ...wider],
  }
}
