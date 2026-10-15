import { expect, test } from "bun:test"
import { correctionSize, PrefixSum } from "@linebreak/layout/numeric/prefix"
import { prefixSums } from "@linebreak/layout/sums"
import { box, glue, paragraphEnd } from "@linebreak/layout"
import { budgetFlex, pooledFlex } from "@linebreak/layout/flex"

const accumulate = (values: readonly number[]) => {
  const prefix = new PrefixSum(values.length)
  values.forEach((value, index) => {
    prefix.add(value)
    prefix.save(index + 1)
  })
  return { prefix, correction: prefix.correction((index) => [values[index]!]) }
}

test("exact dyadic prefixes require no correction storage", () => {
  for (const values of [
    [],
    [0, 0, 0],
    [1, 2, 3, -6],
    Array.from({ length: 128 }, (_, index) => (((index * 17) % 97) - 48) / 16),
  ]) {
    // Every prefix lies on the same binary lattice and fits in 53 bits.
    const { correction } = accumulate(values)
    expect(correction).toBeNull()
  }
})

test("one exact residual word is sufficient until a second residual is lost", () => {
  const compact = accumulate([1e16, 1, 2])
  expect(compact.correction?.kind).toBe("low")
  if (compact.correction?.kind !== "low") return
  expect(compact.correction.values.byteLength).toBe(
    4 * Float64Array.BYTES_PER_ELEMENT,
  )
  expect(correctionSize(compact.correction, compact.prefix.values[3]!, 3)).toBe(
    1,
  )

  const exact = accumulate([1e100, 1, 1e-100])
  expect(exact.correction?.kind).toBe("wide")
  expect(correctionSize(exact.correction, exact.prefix.values[3]!, 3)).toBe(1)
})

test("nonfinite and overflowing visible prefixes require an unbounded pruning allowance", () => {
  for (const values of [
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [Number.MAX_VALUE, Number.MAX_VALUE],
  ]) {
    const { prefix, correction } = accumulate(values)
    expect(
      correctionSize(correction, prefix.values[values.length]!, values.length),
    ).toBe(Number.POSITIVE_INFINITY)
  }
})

test("a certified equal-space pool reuses existing count storage", () => {
  const emptySource = { start: 0, end: 0 }
  for (const unit of [0, 5 / 3, -5 / 3, Number.MIN_VALUE, Number.MAX_VALUE]) {
    const items = [
      glue(0, 0, 0, emptySource),
      box(10),
      glue(1, 0, unit),
      box(10),
      glue(1, 0, unit),
      ...paragraphEnd(),
    ]
    const sums = prefixSums(items, undefined)
    expect(sums.corrections.shrink).toEqual({ kind: "uniform", unit })
    expect(sums.shrink).toBe(sums.spaces)
  }
})

test("nonfinite units cannot receive a finite equal-space certificate", () => {
  for (const unit of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    const sums = prefixSums([box(1), glue(0, 0, unit)], undefined)
    expect(sums.corrections.shrink?.kind).not.toBe("uniform")
  }
})

test("bounded dyadic Flex preparation needs no correction entries", () => {
  const items = [box(2), box(4)]
  const first = budgetFlex(items, 0.25, 0.125, new Set())
  const second = budgetFlex(items, 0.5, 0.25, new Set())
  const pooled = pooledFlex(first, second)
  const plain = {
    stretch: new Float64Array([0, 1.5, 4.5]),
    shrink: new Float64Array([0, 0.75, 2.25]),
  }
  for (const flex of [plain, pooled]) {
    const sums = prefixSums(items, flex)
    expect(sums.stretch).toEqual([0, 1.5, 4.5])
    expect(sums.shrink).toEqual([0, 0.75, 2.25])
    // Each represented endpoint and intermediate difference is an exact
    // binary fraction. Recovery storage would add cost without precision.
    expect(sums.corrections.stretch).toBeNull()
    expect(sums.corrections.shrink).toBeNull()
  }
})

test("one-word builder residuals remain compact when Flex enters the solver", () => {
  const items = [box(1e16), box(1), box(3)]
  const flex = budgetFlex(items, 1, 1, new Set())
  const sums = prefixSums(items, flex)
  for (const side of ["stretch", "shrink"] as const) {
    const correction = sums.corrections[side]
    expect(correction?.kind).toBe("low")
    if (correction?.kind !== "low") continue
    expect(Array.from(correction.values)).toEqual([0, 0, 1, 0])
    expect(sums[side]).toEqual([0, 1e16, 1e16, 1e16 + 4])
  }
})
