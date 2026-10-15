import { randomSource } from "./random"

export const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const quantile = (values: readonly number[], fraction: number) => {
  if (values.length === 0) return 0
  const ordered = [...values].sort((left, right) => left - right)
  const position = Math.max(0, Math.min(1, fraction)) * (ordered.length - 1)
  const index = Math.floor(position)
  const low = ordered[index] as number
  const high = ordered[Math.min(index + 1, ordered.length - 1)] as number
  return low + (high - low) * (position - index)
}

export type Interval = { estimate: number; lower: number; upper: number; samples: number }

/** Resample whole paired observations, preserving covariance within each pair. */
export const pairedSpeedup = (
  candidate: readonly number[],
  reference: readonly number[],
  seed = 20260904,
  repetitions = 5000,
): Interval | null => {
  if (candidate.length !== reference.length) throw new Error("Unpaired timings")
  if (candidate.length < 2) return null
  if ([...candidate, ...reference].some((value) => !Number.isFinite(value) || value <= 0)) {
    return null
  }
  const random = randomSource(seed)
  const ratios: number[] = []
  for (let sample = 0; sample < repetitions; sample += 1) {
    let numerator = 0
    let denominator = 0
    for (let index = 0; index < candidate.length; index += 1) {
      const chosen = Math.floor(random() * candidate.length)
      numerator += reference[chosen] as number
      denominator += candidate[chosen] as number
    }
    ratios.push(numerator / denominator)
  }
  return {
    estimate: mean(reference) / mean(candidate),
    lower: quantile(ratios, 0.025),
    upper: quantile(ratios, 0.975),
    samples: candidate.length,
  }
}

export type Verdict = "win" | "tie" | "loss"

/** Differences below declared physical/rounding tolerance are ties. */
export const compare = (candidate: number, reference: number, epsilon: number): Verdict => {
  if (!Number.isFinite(candidate) || !Number.isFinite(reference)) {
    throw new Error("Cannot rank nonfinite measurements")
  }
  if (Math.abs(candidate - reference) <= epsilon) return "tie"
  return candidate < reference ? "win" : "loss"
}
