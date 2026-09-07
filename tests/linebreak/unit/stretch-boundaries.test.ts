import { expect, test } from "vitest"
import { calibrateStretch } from "@linebreak/text/stretch"

test.each([0, -0, -1, Number.NaN, Infinity, -Infinity])(
  "an unusable baseline %s stops before requesting axis measurements",
  (base) => {
    const requested: number[] = []
    const scale = calibrateStretch(0.02, (pct) => {
      requested.push(pct)
      return base * pct / 100
    })
    expect(scale).toBeNull()
    expect(requested).toEqual([100])
  },
)

test("exact budget saturation ends each expensive probe sequence", () => {
  const requested: number[] = []
  const reach = 1 / 64
  const scale = calibrateStretch(reach, (pct) => {
    requested.push(pct)
    if (pct === 100) return 1
    if (pct === 99) return 1 - reach
    if (pct === 101) return 1 + reach
    throw new Error("A saturated axis must not request another measurement")
  })
  expect(scale?.steps).toEqual([
    { pct: 99, ratio: 1 - reach },
    { pct: 100, ratio: 1 },
    { pct: 101, ratio: 1 + reach },
  ])
  expect(requested).toEqual([100, 99, 101])
})

test("rounding slack includes its boundary without admitting a larger excess", () => {
  const reach = 1 / 64
  const probe = (pct: number) => 1 + (pct - 100) * reach
  const scale = calibrateStretch(reach - 1e-12, probe)
  expect(scale?.steps).toEqual([
    { pct: 99, ratio: 1 - reach },
    { pct: 100, ratio: 1 },
    { pct: 101, ratio: 1 + reach },
  ])
  expect(calibrateStretch(reach - 2e-12, probe)).toBeNull()
})

test.each([0, -Number.MIN_VALUE, -1, -Infinity, Infinity, Number.NaN])(
  "a nonpositive or nonfinite measurement %s invalidates either side",
  (invalid) => {
    for (const side of [99, 101]) {
      const scale = calibrateStretch(0.02, (pct) =>
        pct === side ? invalid : pct / 100,
      )
      expect(scale).toBeNull()
    }
  },
)
