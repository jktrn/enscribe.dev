import { describe, expect, test } from "vitest"
import type { LineTrack } from "@linebreak/layout/tracking"
import {
  expectPx,
  lineOf,
  render,
  renderText,
  settle,
  TEXT,
} from "./support/render"

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

    expectPx(span.style.letterSpacing, 9 / LETTERS)
    expect(span.hasAttribute("data-linebreak-letter-fit")).toBe(true)
  })

  test("the word spacing gives back what the spaces would have kept", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }))

    expectPx(span.style.wordSpacing, -(9 / LETTERS))
    expect(span.hasAttribute("data-linebreak-word-fit")).toBe(true)
  })

  test("a closed line is spread the same way, negative", () => {
    const span = render(
      lineOf({ naturalWidth: 320 }),
      310,
      null,
      letterfitOf({ gain: -6 }),
    )

    expectPx(span.style.letterSpacing, -6 / LETTERS)
  })

  test("the drawn hyphen takes a unit of its own", () => {
    const span = render(
      lineOf({ breakKind: "hyphen" }),
      310,
      null,
      letterfitOf({ gain: 9 }),
    )

    expectPx(span.style.letterSpacing, 9 / (LETTERS + 1))
  })

  test("a character outside the basic plane is one unit, not two", () => {
    const span = renderText("ab 🙂 cd", 310, letterfitOf({ gain: 7 }))

    expectPx(span.style.letterSpacing, 7 / 5)
  })

  test.each([
    ["a\u2060b", 2],
    ["a\uFEFFb", 2],
    ["a\u200Bb", 2],
    ["a\u00ADb", 2],
    ["a\u200Db", 2],
    ["a\u0301b", 2],
    ["👩‍👩‍👧‍👦ab", 3],
    ["🇺🇸ab", 3],
    ["🙂️ab", 3],
  ] as const)("tracking follows rendered graphemes in %s", (text, units) => {
    const span = renderText(text, 310, letterfitOf({ gain: 6 }))
    expectPx(span.style.letterSpacing, 6 / units)
    expect(span.textContent).toBe(text)
  })

  test("the collapsible edges the line never renders are not units", () => {
    const span = renderText("  ab cd  ", 310, letterfitOf({ gain: 5 }))

    expectPx(span.style.letterSpacing, 5 / 4)
  })

  test("a line the letterfit left alone carries no declaration", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 0 }))

    expect(span.style.letterSpacing).toBe("")
    expect(span.hasAttribute("data-linebreak-letter-fit")).toBe(false)
    expect(span.hasAttribute("data-linebreak-word-fit")).toBe(false)
  })

  test("tracking off leaves every line alone", () => {
    const span = render(lineOf(), 310, null)

    expect(span.style.letterSpacing).toBe("")
  })
})

describe("what the line already inherited", () => {
  test("the author's own letterspacing is carried, not clobbered", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }, 0.4))

    expectPx(span.style.letterSpacing, 0.4 + 9 / LETTERS)
  })

  test("a letterspaced line never overrides the author's own features", () => {
    const span = render(lineOf(), 310, null, letterfitOf({ gain: 9 }))

    expect(span.style.fontFeatureSettings).toBe("")
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

    expectPx(span.style.wordSpacing, 6 / LETTERS - 4 / 7)
  })

  test("the spaces are charged the glue's own shrink, not the pooled one", () => {
    const span = render(
      lineOf({ naturalWidth: 340, shrink: 30 }),
      300,
      null,
      letterfitOf({ gain: -12, shrink: 9 }),
    )

    expectPx(span.style.wordSpacing, 12 / LETTERS - 9 / 7)
  })

  test("a line the letterfit alone brought inside is not squeezed", () => {
    const span = render(
      lineOf({ naturalWidth: 312, shrink: 12 }),
      310,
      null,
      letterfitOf({ gain: -2, shrink: 6 }),
    )

    expectPx(span.style.wordSpacing, 2 / LETTERS)
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
    expectPx(span.style.wordSpacing, -(4 / LETTERS) - 2 / 7)
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
