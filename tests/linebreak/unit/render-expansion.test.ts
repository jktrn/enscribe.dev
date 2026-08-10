import { describe, expect, test } from "bun:test"
import { lineOf, render, settle } from "./support/render"

describe("the percentage the renderer writes", () => {
  test("a line the optimizer widened is set at that percentage", () => {
    const span = render(lineOf(), 310, [
      { pct: 101, gain: 3, stretch: 20, shrink: 7 },
    ])

    expect(span.style.fontStretch).toBe("101%")
  })

  test("a line the optimizer narrowed is set at that percentage", () => {
    const span = render(lineOf({ naturalWidth: 320 }), 310, [
      { pct: 98.5, gain: -4, stretch: 20, shrink: 7 },
    ])

    expect(span.style.fontStretch).toBe("98.5%")
  })

  test("a line left at 100 carries no declaration at all", () => {
    const span = render(lineOf(), 310, [
      { pct: 100, gain: 0, stretch: 20, shrink: 7 },
    ])

    expect(span.style.fontStretch).toBeUndefined()
  })

  test("a font with no width axis leaves every line alone", () => {
    const span = render(lineOf(), 310, null)

    expect(span.style.fontStretch).toBeUndefined()
  })
})

describe("the word-spacing rescue under expansion", () => {
  test("the glyphs' gain counts toward the overflow it has to absorb", () => {
    const span = render(lineOf({ naturalWidth: 300, shrink: 12 }), 301, [
      { pct: 102, gain: 7, stretch: 20, shrink: 8 },
    ])

    expect(span.style.wordSpacing).toBe(`${-(6 / 7)}px`)
  })

  test("the spaces are charged the glue's own shrink, not the pool's", () => {
    const withPool = render(lineOf({ naturalWidth: 340, shrink: 30 }), 300, [
      { pct: 98, gain: -8, stretch: 20, shrink: 9 },
    ])

    expect(withPool.style.wordSpacing).toBe(`${-(9 / 7)}px`)
  })

  test("a line that still fits after expanding is not squeezed", () => {
    const span = render(lineOf({ naturalWidth: 300 }), 320, [
      { pct: 101, gain: 3, stretch: 20, shrink: 7 },
    ])

    expect(span.style.wordSpacing).toBeUndefined()
  })
})

describe("the width the font really delivered", () => {
  test("a line that lands past the measure is tightened by the excess", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300 }),
      310,
      [{ pct: 98, gain: -6, stretch: 20, shrink: 7 }],
      312,
    )

    expect(tightened).toBe(1)
    expect(span.style.wordSpacing).toBe(`${-(2 / 7)}px`)
  })

  test("the excess is charged on top of the rescue already written", () => {
    const { span } = settle(
      lineOf({ naturalWidth: 340, shrink: 30 }),
      300,
      [{ pct: 98, gain: -8, stretch: 20, shrink: 32 }],
      303,
    )

    expect(Number.parseFloat(span.style.wordSpacing as string)).toBeCloseTo(
      -(35 / 7),
      9,
    )
  })

  test("a line that cannot close its overrun is not squeezed for it", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 340, shrink: 30 }),
      300,
      [{ pct: 98, gain: -8, stretch: 20, shrink: 9 }],
      303,
    )

    expect(tightened).toBe(0)
    expect(span.style.wordSpacing).toBe(`${-(9 / 7)}px`)
  })

  test("a line may still reach past the measure by what it hangs", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300, hangEnd: 3 }),
      310,
      [{ pct: 98, gain: -6, stretch: 20, shrink: 7 }],
      313,
    )

    expect(tightened).toBe(0)
    expect(span.style.wordSpacing).toBeUndefined()
  })

  test("a line the optimizer left at 100 per cent is never measured", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300 }),
      310,
      [{ pct: 100, gain: 0, stretch: 20, shrink: 7 }],
      312,
    )

    expect(tightened).toBe(0)
    expect(span.measured.calls).toBe(0)
  })

  test("a line without a space to charge is left as it was written", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300, spaceCount: 0 }),
      310,
      [{ pct: 98, gain: -6, stretch: 20, shrink: 7 }],
      312,
    )

    expect(tightened).toBe(0)
    expect(span.measured.calls).toBe(0)
  })

  test("a font with no width axis costs the renderer no measurement", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 320 }),
      310,
      null,
      312,
    )

    expect(tightened).toBe(0)
    expect(span.measured.calls).toBe(0)
  })
})
