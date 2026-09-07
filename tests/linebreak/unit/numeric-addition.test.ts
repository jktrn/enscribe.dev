import { expect, test } from "bun:test"
import {
  dyadic,
  exactSum,
  roundedDyadic,
} from "@linebreak/layout/numeric/dyadic"
import { roundoff } from "@linebreak/layout/numeric/sum"
import cases from "./support/exact-additions.json"

test("the floating-point error transform returns the independent exact rational residual", () => {
  // Python Fraction generates these errors; no copy of the error-transform
  // algorithm participates in the expectation. Finite sums include underflow.
  for (const entry of cases) {
    expect(roundoff(entry.a, entry.b, entry.high)).toBe(entry.error)
    const left = dyadic(entry.a)
    const right = dyadic(entry.b)
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    if (left === null || right === null) continue
    expect(roundedDyadic(left + right)).toBe(entry.high)
  }
})

test("nonfinite geometry never becomes an exact finite dyadic coefficient", () => {
  for (const value of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    expect(dyadic(value)).toBeNull()
    expect(exactSum([value, -value])).toBeNaN()
  }
})
