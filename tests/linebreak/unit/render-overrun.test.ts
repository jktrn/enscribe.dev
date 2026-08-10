import { describe, expect, test } from "bun:test"
import { layoutSlack } from "@linebreak/dom/render"
import { lineOf, render } from "./support/render"

describe("the overrun a line cannot close", () => {
  test("a line inside the measure hangs nothing", () => {
    const span = render(lineOf({ naturalWidth: 300, shrink: 12 }), 310, null)

    expect(span.style.marginInlineEnd).toBeUndefined()
  })

  test("a line that fits once its spaces close hangs nothing", () => {
    const span = render(lineOf({ naturalWidth: 308, shrink: 12 }), 300, null)

    expect(span.style.marginInlineEnd).toBeUndefined()
  })

  test("what is left after the spaces close is hung past the measure", () => {
    const span = render(lineOf({ naturalWidth: 340, shrink: 9 }), 300, null)

    expect(span.style.marginInlineEnd).toBe("-31px")
  })

  test("the protrusion hang and the overrun share one margin", () => {
    const span = render(
      lineOf({ naturalWidth: 340, shrink: 9, hangEnd: 4 }),
      300,
      null,
    )

    expect(span.style.marginInlineEnd).toBe("-35px")
  })

  test("the glyphs' own narrowing counts against the overrun", () => {
    const span = render(lineOf({ naturalWidth: 340, shrink: 30 }), 300, [
      { pct: 98, gain: -8, stretch: 20, shrink: 9 },
    ])

    expect(span.style.marginInlineEnd).toBe("-23px")
  })

  test("a line with no space to close it hangs the whole overrun", () => {
    const span = render(
      lineOf({ naturalWidth: 340, shrink: 0, spaceCount: 0 }),
      300,
      null,
    )

    expect(span.style.marginInlineEnd).toBe("-40px")
  })
})

describe("the slack the paragraph is verified against", () => {
  test("a paragraph that stays inside the measure claims none", () => {
    const slack = layoutSlack({
      lines: [lineOf({ naturalWidth: 300 }), lineOf({ naturalWidth: 290 })],
      target: 300,
      fits: null,
      letterfit: null,
    })

    expect(slack).toBe(0)
  })

  test("the furthest line's reach is what the paragraph claims", () => {
    const slack = layoutSlack({
      lines: [
        lineOf({ naturalWidth: 300, hangEnd: 5 }),
        lineOf({ naturalWidth: 340, shrink: 9, hangEnd: 2 }),
      ],
      target: 300,
      fits: null,
      letterfit: null,
    })

    expect(slack).toBe(33)
  })
})
