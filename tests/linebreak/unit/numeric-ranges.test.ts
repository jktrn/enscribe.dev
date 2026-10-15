import { expect, test } from "bun:test"
import { PrefixSum } from "@linebreak/layout/numeric/prefix"
import { rangeDifference, rangeSum } from "@linebreak/layout/numeric/range"
import { newSum } from "@linebreak/layout/numeric/sum"
import cases from "./support/exact-ranges.json"

test("range sums match independent exact rational arithmetic through binary64 extremes", () => {
  // Generated with Python Fraction.from_float, seed 1981. Each expectation is
  // rounded once from the exact rational sum, independent of the solver helpers.
  for (const entry of cases) {
    const prefix = new PrefixSum(entry.values.length)
    entry.values.forEach((value, index) => {
      prefix.add(value)
      prefix.save(index + 1)
    })
    const correction = prefix.correction((index) => [entry.values[index]!])
    for (const range of entry.ranges) {
      const actual = rangeSum(
        newSum(),
        correction,
        range.start,
        range.end,
        prefix.values[range.start]!,
        prefix.values[range.end]!,
        range.extras[0],
        range.extras[1],
        range.extras[2],
        range.extras[3],
      )
      expect(actual).toBe(Number(range.expected))
      expect(
        rangeDifference(
          newSum(),
          correction,
          range.start,
          range.end,
          prefix.values[range.start]!,
          prefix.values[range.end]!,
        ),
      ).toBe(Number(range.difference))
    }
  }
})

test("opening residuals decide which side of a distant rounding midpoint a range occupies", () => {
  for (const [values, start, expected] of [
    [[1, 2 ** 100, 2 ** 47], 1, 2 ** 100],
    [[2 ** 100, 1, -(2 ** 100), 2 ** 46], 2, -(2 ** 100)],
    [[2 ** 100, 1, -(2 ** 100), 2 ** 46, -(2 ** -50)], 2, -(2 ** 100)],
    [[2 ** 154, -1, 1, 2 ** 153, 2 ** 100], 2, 2 ** 153 + 2 ** 101],
  ] as const) {
    // Residuals can decide either side of a midpoint. In the final case the
    // exact range is 2^153 + 2^100 + 1, just above halfway, although the high
    // prefix difference is exact. Rounding the low difference first loses 1.
    const prefix = new PrefixSum(values.length)
    values.forEach((value, index) => {
      prefix.add(value)
      prefix.save(index + 1)
    })
    const correction = prefix.correction((index) => [values[index]!])
    const end = values.length
    expect(
      rangeDifference(
        newSum(),
        correction,
        start,
        end,
        prefix.values[start]!,
        prefix.values[end]!,
      ),
    ).toBe(expected)
    expect(
      rangeSum(
        newSum(),
        correction,
        start,
        end,
        prefix.values[start]!,
        prefix.values[end]!,
      ),
    ).toBe(expected)
  }
})
