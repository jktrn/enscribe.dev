import { dyadic, roundedDyadic } from "./dyadic"
import { add, newSum } from "./sum"

export type Correction =
  | { readonly kind: "low"; readonly values: Float64Array }
  | { readonly kind: "wide"; readonly values: readonly (bigint | null)[] }

export type CapacityCorrection =
  | Correction
  | { readonly kind: "uniform"; readonly unit: number }

export type PrefixTerm = number | bigint
export type PrefixTerms = (index: number) => readonly PrefixTerm[]

const exactPrefixes = (count: number, terms: PrefixTerms) => {
  const values: Array<bigint | null> = [0n]
  let total: bigint | null = 0n
  for (let index = 0; index < count; index += 1) {
    for (const term of terms(index)) {
      const value = typeof term === "bigint" ? term : dyadic(term)
      total = total === null || value === null ? null : total + value
    }
    values.push(total)
  }
  return values
}

export class PrefixSum {
  readonly values = [0]
  private readonly sum = newSum()
  private low: Float64Array | null = null

  constructor(private readonly count: number) {}

  add(value: number) {
    add(this.sum, value)
  }

  addExact(value: bigint) {
    this.sum.lost = true
    this.add(roundedDyadic(value))
  }

  save(index: number) {
    this.values[index] = this.sum.high
    if (this.sum.low !== 0 && !this.low)
      this.low = new Float64Array(this.count + 1)
    if (this.low) this.low[index] = this.sum.low
  }

  correction(terms: PrefixTerms): Correction | null {
    if (this.sum.lost)
      return { kind: "wide", values: exactPrefixes(this.count, terms) }
    return this.low ? { kind: "low", values: this.low } : null
  }
}

export const correctionSize = (
  correction: CapacityCorrection | null,
  high: number,
  index: number,
) => {
  // A uniform prefix has only one product rounding; the pruning scale budget
  // already covers it. Low/wide carries instead include accumulated error.
  if (!correction || correction.kind === "uniform") return 0
  if (correction.kind === "low")
    return Math.abs(correction.values[index] as number)
  const approximate = dyadic(high)
  // A nonfinite input poisons both the exact prefix and its visible sum.
  if (approximate === null) return Number.POSITIVE_INFINITY
  const precise = correction.values[index] as bigint
  return Math.abs(roundedDyadic(precise - approximate))
}

export const prefixValue = (
  correction: CapacityCorrection | null,
  stored: number,
) => (correction?.kind === "uniform" ? stored * correction.unit : stored)
