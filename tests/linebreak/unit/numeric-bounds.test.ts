import { expect, test } from "bun:test"
import { boundedPrefixes, finiteTerms } from "@linebreak/layout/numeric/bounds"
import { dyadic } from "@linebreak/layout/numeric/dyadic"
import { PrefixSum } from "@linebreak/layout/numeric/prefix"

test("finite pool certificates cover signed prefixes and every retained representation", () => {
  for (const terms of [
    [0, 1, -2, 1],
    [2 ** 100, 1, -(2 ** 100)],
    [1e100, 1, 1e-100, -1e100],
  ]) {
    const prefix = new PrefixSum(terms.length)
    terms.forEach((value, index) => {
      prefix.add(value)
      prefix.save(index + 1)
    })
    const correction = prefix.correction((index) => [terms[index]!])
    expect(finiteTerms(correction)).toBe(true)
    expect(boundedPrefixes(prefix.values, correction)).toBe(true)
  }
  expect(boundedPrefixes([0, 2, 8], { kind: "uniform", unit: -5 / 3 })).toBe(
    true,
  )
  expect(
    boundedPrefixes([0, 1, 2], { kind: "uniform", unit: Number.MAX_VALUE }),
  ).toBe(false)
})

test("uncertified prefixes stay distinguishable from nonfinite authored terms", () => {
  for (const value of [Number.MAX_VALUE, -Number.MAX_VALUE]) {
    expect(boundedPrefixes([0, value], null)).toBe(false)
    expect(
      boundedPrefixes([0, value], { kind: "low", values: new Float64Array(2) }),
    ).toBe(false)
    const correction = { kind: "wide" as const, values: [0n, dyadic(value)] }
    expect(finiteTerms(correction)).toBe(true)
    expect(boundedPrefixes([0, value], correction)).toBe(false)
  }
  const invalid = { kind: "wide" as const, values: [0n, null] }
  expect(finiteTerms(invalid)).toBe(false)
  expect(boundedPrefixes([0, Number.NaN], invalid)).toBe(false)
})

test("certificate boundaries include exact limits and account for accumulated low carries", () => {
  const limit = Number.MAX_VALUE / 8
  expect(boundedPrefixes([0, limit, -limit], null)).toBe(true)
  const quarterUlp = 2 ** 966
  const values = [limit, quarterUlp, quarterUlp, quarterUlp]
  const prefix = new PrefixSum(values.length)
  values.forEach((value, index) => {
    prefix.add(value)
    prefix.save(index + 1)
  })
  const correction = prefix.correction((index) => [values[index]!])
  expect(correction?.kind).toBe("low")
  expect(prefix.values.at(-1)).toBe(limit)
  // Three exact quarter-ULP terms cross the certificate's upper bound even
  // though every addition to the high component rounds down separately.
  expect(boundedPrefixes(prefix.values, correction)).toBe(false)
})

test("exact-prefix certificates retain their wider signed limits after earlier cancellation", () => {
  for (const sign of [-1, 1]) {
    const values = [
      2 ** 100,
      1,
      2 ** -100,
      -(2 ** 100),
      -1,
      -(2 ** -100),
      (sign * Number.MAX_VALUE) / 4,
    ]
    const prefix = new PrefixSum(values.length)
    values.forEach((value, index) => {
      prefix.add(value)
      prefix.save(index + 1)
    })
    const correction = prefix.correction((index) => [values[index]!])
    expect(correction?.kind).toBe("wide")
    expect(boundedPrefixes(prefix.values, correction)).toBe(true)
  }
})
