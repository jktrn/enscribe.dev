import { dyadic, roundedDyadic } from "./dyadic"
import type { Correction, PrefixSum, PrefixTerm } from "./prefix"
import { rangeDifference } from "./range"
import { add, newSum, reset, type SumState } from "./sum"

type Record = {
  readonly highs: Float64Array
  readonly correction: Correction
}

const records = new WeakMap<Float64Array, Record>()

export const correctedCapacity = (
  array: Float64Array,
  correction: Correction | null,
) => {
  if (correction) records.set(array, { highs: array.slice(), correction })
  return array
}

const currentCorrection = (array: Float64Array, index: number) => {
  const record = records.get(array)
  const value = array[index]
  return record && value !== undefined && Object.is(value, record.highs[index])
    ? record.correction
    : null
}

const pointTerms = (array: Float64Array, index: number): PrefixTerm[] => {
  const correction = currentCorrection(array, index)
  if (correction?.kind === "wide")
    return [correction.values[index] ?? Number.NaN]
  const value = array[index] as number
  return correction ? [value, correction.values[index] as number] : [value]
}

export const capacityTerms = (
  array: Float64Array,
  start: number,
  end: number,
) => [
  ...pointTerms(array, end),
  ...pointTerms(array, start).map((value) => -value),
]

const addPoint = (
  sum: PrefixSum,
  array: Float64Array,
  index: number,
  sign: number,
) => {
  const correction = currentCorrection(array, index)
  if (correction?.kind === "wide") {
    const value = correction.values[index]
    if (value === null) sum.add(Number.NaN)
    else sum.addExact((value as bigint) * BigInt(sign))
    return
  }
  sum.add(sign * (array[index] as number))
  if (correction) sum.add(sign * (correction.values[index] as number))
}

export const addCapacity = (
  sum: PrefixSum,
  array: Float64Array,
  start: number,
  end: number,
) => {
  addPoint(sum, array, end, 1)
  addPoint(sum, array, start, -1)
}

const exactTerms = (terms: readonly PrefixTerm[]) => {
  let result = 0n
  for (const term of terms) {
    const value = typeof term === "bigint" ? term : dyadic(term)
    if (value === null) return null
    result += value
  }
  return result
}

const addStoredPoint = (sum: SumState, array: Float64Array, index: number) => {
  const correction = currentCorrection(array, index)
  add(sum, array[index] as number)
  if (correction?.kind === "low") add(sum, correction.values[index] as number)
  sum.lost ||= correction?.kind === "wide"
}

export const pooledCapacity = (first: Float64Array, second: Float64Array) => {
  const values = new Float64Array(first.length)
  let low: Float64Array | null = null
  let lost = false
  const sum = newSum()
  const termsAt = (index: number) => [
    ...pointTerms(first, index),
    ...pointTerms(second, index),
  ]
  for (let index = 0; index < values.length; index += 1) {
    reset(sum, 0)
    addStoredPoint(sum, first, index)
    addStoredPoint(sum, second, index)
    values[index] = sum.high
    if (sum.low !== 0 && !low) low = new Float64Array(values.length)
    if (low) low[index] = sum.low
    lost ||= sum.lost
  }
  const correction: Correction | null = lost
    ? {
        kind: "wide",
        values: Array.from(values, (_, index) => exactTerms(termsAt(index))),
      }
    : low && { kind: "low", values: low }
  return correctedCapacity(values, correction)
}

export const capacityBetween = (
  array: Float64Array,
  start: number,
  end: number,
) => {
  const before = array[start] as number
  const after = array[end] as number
  const correction = currentCorrection(array, start)
  const ending = currentCorrection(array, end)
  if (!correction && !ending) return after - before
  if (correction === ending && correction?.kind === "low")
    return rangeDifference(newSum(), correction, start, end, before, after)
  const exact = exactTerms(capacityTerms(array, start, end))
  return exact === null ? Number.NaN : roundedDyadic(exact)
}
