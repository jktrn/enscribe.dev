export type NumericDiagnostics = {
  compensatedRangeEvaluations?: number
  exactRangeEvaluations?: number
}
export type SumState = {
  high: number
  low: number
  lost: boolean
  readonly diagnostics: NumericDiagnostics | null
}
export const newSum = (
  diagnostics: NumericDiagnostics | null = null,
): SumState => ({
  high: 0,
  low: 0,
  lost: false,
  diagnostics,
})

/** Ogita–Rump–Oishi Algorithm 3.1: the exact error of a finite addition. */
export const roundoff = (a: number, b: number, sum: number) => {
  const virtual = sum - a
  return a - (sum - virtual) + (b - virtual)
}

export const add = (state: SumState, value: number) => {
  if (value === 0) return
  const high = state.high + value
  const error = roundoff(state.high, value, high)
  const low = state.low + error
  state.lost ||= roundoff(state.low, error, low) !== 0 || !Number.isFinite(high)
  state.high = high
  state.low = low
}

export const reset = (state: SumState, high: number) => {
  state.high = high
  state.low = 0
  state.lost = false
}
