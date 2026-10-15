import { exactSum } from "./dyadic"
import type { CapacityCorrection, Correction } from "./prefix"
import { add, reset, roundoff, type SumState } from "./sum"

export type Corrections = {
  readonly width: Correction | null
  readonly stretch: Correction | null
  readonly shrink: CapacityCorrection | null
}

const wideDifference = (
  state: SumState,
  values: readonly (bigint | null)[],
  start: number,
  end: number,
  extras: readonly number[],
) => {
  const left = values[start] as bigint
  const right = values[end] as bigint | null
  // Invalid exact prefixes remain null, so a valid end implies a valid start.
  return right === null ? Number.NaN : recoverRange(state, extras, right - left)
}

const recoverRange = (
  state: SumState,
  values: readonly number[],
  initial = 0n,
) => {
  if (state.diagnostics)
    state.diagnostics.exactRangeEvaluations =
      (state.diagnostics.exactRangeEvaluations ?? 0) + 1
  return exactSum(values, initial)
}

const startRange = (
  state: SumState,
  before: number,
  after: number,
  lowStart: number,
  lowEnd: number,
) => {
  if (state.diagnostics)
    state.diagnostics.compensatedRangeEvaluations =
      (state.diagnostics.compensatedRangeEvaluations ?? 0) + 1
  reset(state, after)
  add(state, -before)
  add(state, lowEnd)
  add(state, -lowStart)
}

export const rangeDifference = (
  state: SumState,
  correction: CapacityCorrection | null,
  start: number,
  end: number,
  before: number,
  after: number,
): number => {
  if (!correction) return after - before
  if (correction.kind === "uniform")
    return (after - before) * correction.unit + 0
  if (correction.kind === "wide")
    return wideDifference(state, correction.values, start, end, [])
  const lowStart = correction.values[start] as number
  const lowEnd = correction.values[end] as number
  const high = after - before
  const low = lowEnd - lowStart
  // Two exact differences followed by one addition need only one rounding.
  if (
    roundoff(after, -before, high) === 0 &&
    roundoff(lowEnd, -lowStart, low) === 0
  )
    return high + low
  startRange(state, before, after, lowStart, lowEnd)
  return state.lost
    ? recoverRange(state, [after, -before, lowEnd, -lowStart])
    : state.high + state.low
}

export const rangeSum = (
  state: SumState,
  correction: Correction | null,
  start: number,
  end: number,
  before: number,
  after: number,
  first = 0,
  second = 0,
  third = 0,
  fourth = 0,
): number => {
  if (correction?.kind === "wide")
    return wideDifference(state, correction.values, start, end, [
      first,
      second,
      third,
      fourth,
    ])
  const lowStart = correction?.values[start] ?? 0
  const lowEnd = correction?.values[end] ?? 0
  startRange(state, before, after, lowStart, lowEnd)
  add(state, first)
  add(state, second)
  add(state, third)
  add(state, fourth)
  return state.lost
    ? recoverRange(state, [
        after,
        -before,
        lowEnd,
        -lowStart,
        first,
        second,
        third,
        fourth,
      ])
    : state.high + state.low
}
