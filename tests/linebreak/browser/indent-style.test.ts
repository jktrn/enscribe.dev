import { describe, expect, test } from "vitest"
import { firstLineIndent, indentsSomeOtherLine } from "@linebreak/dom/style"

// Happy DOM has no parser for the CSS Text hanging/each-line keywords.
const styleOf = (textIndent: string) =>
  new Proxy(document.createElement("span").style, {
    get: (style, property) =>
      property === "textIndent" ? textIndent : Reflect.get(style, property),
  })

describe("reading text-indent off a computed style", () => {
  test("a length is taken as written", () => {
    expect(firstLineIndent(styleOf("48px"), 520)).toBe(48)
    expect(firstLineIndent(styleOf("-32px"), 520)).toBe(-32)
    expect(firstLineIndent(styleOf("0px"), 520)).toBe(0)
  })

  test("a percentage resolves against the content width", () => {
    expect(firstLineIndent(styleOf("10%"), 520)).toBeCloseTo(52, 9)
    expect(firstLineIndent(styleOf("10%"), 400)).toBeCloseTo(40, 9)
    expect(firstLineIndent(styleOf("-5%"), 520)).toBeCloseTo(-26, 9)
  })

  test("an unreadable value indents nothing", () => {
    expect(firstLineIndent(styleOf(""), 520)).toBe(0)
    expect(firstLineIndent(styleOf("auto"), 520)).toBe(0)
  })
})

describe("indents that move a line other than the first", () => {
  test("the hanging and each-line keywords are recognised", () => {
    expect(indentsSomeOtherLine(styleOf("48px hanging"))).toBe(true)
    expect(indentsSomeOtherLine(styleOf("48px each-line"))).toBe(true)
    expect(indentsSomeOtherLine(styleOf("48px hanging each-line"))).toBe(true)
  })

  test("a plain indent is not one of them", () => {
    expect(indentsSomeOtherLine(styleOf("48px"))).toBe(false)
    expect(indentsSomeOtherLine(styleOf("10%"))).toBe(false)
    expect(indentsSomeOtherLine(styleOf("0px"))).toBe(false)
    expect(indentsSomeOtherLine(styleOf(""))).toBe(false)
  })
})
