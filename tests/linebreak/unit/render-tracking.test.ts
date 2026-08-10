import { describe, expect, test } from "bun:test"
import type { LineTrack } from "@linebreak/layout/tracking"
import { lineOf, render, renderText, settle, TEXT } from "./support/render"

const UNITS = TEXT.length
const SPACES = 7
const LETTERS = UNITS - SPACES

const letterfitOf = (track: Partial<LineTrack> = {}, inherited = 0) => ({
  lines: [{ gain: 0, shrink: 3, ...track }],
  inherited,
})

describe("the letter-spacing the renderer writes", () => {
  test("the line's whole letterfit is spread over the letters it renders", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }))

    expect(span.style.letterSpacing).toBe(`${9 / LETTERS}px`)
  })

  test("the word spacing gives back what the spaces would have kept", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }))

    expect(span.style.wordSpacing).toBe(`${-(9 / LETTERS)}px`)
  })

  test("a closed line is spread the same way, negative", () => {
    const span = render(
      lineOf({ naturalWidth: 320 }),
      310,
      null,
      letterfitOf({ gain: -6 }),
    )

    expect(span.style.letterSpacing).toBe(`${-6 / LETTERS}px`)
  })

  test("the drawn hyphen takes a unit of its own", () => {
    const span = render(
      lineOf({ breakKind: "hyphen" }),
      310,
      null,
      letterfitOf({ gain: 9 }),
    )

    expect(span.style.letterSpacing).toBe(`${9 / (LETTERS + 1)}px`)
  })

  test("a character outside the basic plane is one unit, not two", () => {
    const span = renderText("ab 🙂 cd", 310, letterfitOf({ gain: 7 }))

    expect(span.style.letterSpacing).toBe(`${7 / 5}px`)
  })

  test("the collapsible edges the line never renders are not units", () => {
    const span = renderText("  ab cd  ", 310, letterfitOf({ gain: 5 }))

    expect(span.style.letterSpacing).toBe(`${5 / 4}px`)
  })

  test("a line the letterfit left alone carries no declaration", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 0 }))

    expect(span.style.letterSpacing).toBeUndefined()
  })

  test("tracking off leaves every line alone", () => {
    const span = render(lineOf(), 310, null)

    expect(span.style.letterSpacing).toBeUndefined()
  })
})

describe("what the line already inherited", () => {
  test("the author's own letterspacing is carried, not clobbered", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }, 0.4))

    expect(span.style.letterSpacing).toBe(`${0.4 + 9 / LETTERS}px`)
  })

  test("a letterspaced line never overrides the author's own features", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }))

    expect(span.style.fontFeatureSettings).toBeUndefined()
  })
})

describe("the word-spacing rescue under tracking", () => {
  test("what the letterfit closed counts toward the overflow left", () => {
    const span = render(
      lineOf({ naturalWidth: 320, shrink: 12 }),
      310,
      null,
      letterfitOf({ gain: -6, shrink: 6 }),
    )

    expect(span.style.wordSpacing).toBe(`${6 / LETTERS - 4 / 7}px`)
  })

  test("the spaces are charged the glue's own shrink, not the pooled one", () => {
    const span = render(
      lineOf({ naturalWidth: 340, shrink: 30 }),
      300,
      null,
      letterfitOf({ gain: -12, shrink: 9 }),
    )

    expect(span.style.wordSpacing).toBe(`${12 / LETTERS - 9 / 7}px`)
  })

  test("a line the letterfit alone brought inside is not squeezed", () => {
    const span = render(
      lineOf({ naturalWidth: 312, shrink: 12 }),
      310,
      null,
      letterfitOf({ gain: -2, shrink: 6 }),
    )

    expect(span.style.wordSpacing).toBe(`${2 / LETTERS}px`)
  })
})

describe("the width the letterfit really delivered", () => {
  test("a letterspaced line that lands past the measure is tightened", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300 }),
      310,
      null,
      312,
      letterfitOf({ gain: 4 }),
    )

    expect(tightened).toBe(1)
    expect(span.style.wordSpacing).toBe(`${-(4 / LETTERS) - 2 / 7}px`)
  })

  test("a line the letterfit never touched is never measured", () => {
    const { span, tightened } = settle(
      lineOf({ naturalWidth: 300 }),
      310,
      null,
      312,
      letterfitOf({ gain: 0 }),
    )

    expect(tightened).toBe(0)
    expect(span.measured.calls).toBe(0)
  })
})
