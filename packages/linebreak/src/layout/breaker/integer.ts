import { INFINITE_BADNESS } from "../policy"
import type { Measurement, Search } from "./types"

const fromScaledRatio = (scaled: number) => {
  const integer = Math.floor(scaled)
  return integer > 1290
    ? INFINITE_BADNESS
    : Math.floor((integer ** 3 + 131072) / 262144)
}

/** TeX's quantized cubic formula applied to CSS dimensions, not scaled points. */
export const integerBadness = (search: Search, line: Measurement) => {
  if (line.ratio === 0) return 0
  const capacity =
    line.ratio < 0 ? line.shrink : line.stretch + search.emergencyStretch
  if (!(capacity > 0)) return INFINITE_BADNESS
  const scaled = 297 * Math.abs(search.target - line.natural)
  // measureInto already rescales overflowing differences and capacity sums.
  // Reuse that ratio when the direct scaled expression would lose a finite one.
  return fromScaledRatio(
    Number.isFinite(scaled) && Number.isFinite(capacity)
      ? scaled / capacity
      : 297 * Math.abs(line.ratio),
  )
}

export const integerFitness = (ratio: number, badness: number) => {
  if (badness <= 12) return 1
  if (ratio < 0) return 0
  return badness < 100 ? 2 : 3
}

let lastTolerance = NaN
let lastRejection = Number.MAX_VALUE

/** Invert the quantized cubic, leaving room for both ratio rounding paths. */
export const integerRejectionRatio = (tolerance: number) => {
  if (tolerance === lastTolerance) return lastRejection
  if (!(tolerance >= 0)) return tolerance < 0 ? 1 : Number.MAX_VALUE
  if (tolerance >= INFINITE_BADNESS) return Number.MAX_VALUE
  const threshold = (Math.floor(tolerance) + 1) * 262144 - 131072
  let scaled = Math.ceil(Math.cbrt(threshold))
  while (scaled * scaled * scaled < threshold) scaled += 1
  while ((scaled - 1) * (scaled - 1) * (scaled - 1) >= threshold) scaled -= 1
  lastTolerance = tolerance
  // Quantized badness saturates as soon as the scaled integer exceeds1290.
  // The positive cutoff is normal;16unit-roundoffs cover division/multiply
  // rounding in either slack/capacity or (297*slack)/capacity evaluation.
  lastRejection = Math.min(1291, scaled) / 297 * (1 + 8 * Number.EPSILON)
  return lastRejection
}
