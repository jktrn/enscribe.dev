import { describe, expect, test } from "bun:test"
import { unmodellableProperty } from "@linebreak/dom/style"

const styleOf = (overrides: Partial<Record<string, string>> = {}) =>
  ({
    textTransform: "none",
    wordSpacing: "0px",
    fontStretch: "100%",
    fontVariationSettings: "normal",
    ...overrides,
  }) as unknown as CSSStyleDeclaration

describe("properties the width model cannot follow", () => {
  test("a plain run is modellable", () => {
    expect(unmodellableProperty(styleOf())).toBe(null)
  })

  test("an uppercasing run is declined", () => {
    expect(unmodellableProperty(styleOf({ textTransform: "uppercase" }))).toBe(
      "text-transform",
    )
  })

  test("an authored word-spacing is declined", () => {
    expect(unmodellableProperty(styleOf({ wordSpacing: "2px" }))).toBe(
      "word-spacing",
    )
  })
})

describe("an authored width is the author's, not ours", () => {
  test("a font-stretch percentage is declined", () => {
    expect(unmodellableProperty(styleOf({ fontStretch: "98%" }))).toBe(
      "font-stretch",
    )
  })

  test("a font-stretch keyword is declined", () => {
    expect(
      unmodellableProperty(styleOf({ fontStretch: "semi-condensed" })),
    ).toBe("font-stretch")
  })

  test("the neutral spellings are accepted", () => {
    expect(unmodellableProperty(styleOf({ fontStretch: "normal" }))).toBe(null)
    expect(unmodellableProperty(styleOf({ fontStretch: "100%" }))).toBe(null)
    expect(unmodellableProperty(styleOf({ fontStretch: "" }))).toBe(null)
  })

  test("a wdth variation setting is declined", () => {
    expect(
      unmodellableProperty(
        styleOf({ fontVariationSettings: '"wdth" 95, "wght" 400' }),
      ),
    ).toBe("font-variation-settings")
  })

  test("a variation setting on another axis is accepted", () => {
    expect(
      unmodellableProperty(styleOf({ fontVariationSettings: '"wght" 600' })),
    ).toBe(null)
  })
})
