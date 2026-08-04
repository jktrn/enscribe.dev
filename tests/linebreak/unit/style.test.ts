import { describe, expect, test } from "bun:test"
import {
  probeStyle,
  uniformLetterSpacing,
  unmodellableProperty,
  usesVariant,
  variantKey,
} from "@linebreak/dom/style"

const styleOf = (overrides: Partial<Record<string, string>> = {}) =>
  ({
    textTransform: "none",
    wordSpacing: "0px",
    fontStretch: "100%",
    fontVariationSettings: "normal",
    fontVariantAlternates: "normal",
    fontVariantCaps: "normal",
    fontVariantEastAsian: "normal",
    fontVariantLigatures: "normal",
    fontVariantNumeric: "normal",
    fontVariantPosition: "normal",
    fontFeatureSettings: "normal",
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

describe("glyph substitutions canvas cannot express", () => {
  const SUBSTITUTING: readonly Record<string, string>[] = [
    { fontVariantCaps: "all-small-caps" },
    { fontVariantCaps: "small-caps" },
    { fontVariantNumeric: "oldstyle-nums ordinal" },
    { fontVariantPosition: "super" },
    { fontVariantLigatures: "none" },
    { fontVariantAlternates: "styleset(alt-a)" },
    { fontVariantEastAsian: "jis78" },
    { fontFeatureSettings: '"smcp"' },
  ]

  for (const overrides of SUBSTITUTING) {
    const [property, value] = Object.entries(overrides)[0] as [string, string]

    test(`${property}: ${value} is measured, not declined`, () => {
      expect(usesVariant(styleOf(overrides))).toBe(true)
      expect(unmodellableProperty(styleOf(overrides))).toBe(null)
    })

    test(`${property}: ${value} keys its own metrics`, () => {
      expect(variantKey(styleOf(overrides))).toBe(`${property}:${value};`)
    })
  }

  test("a plain run carries no variant and no key", () => {
    expect(usesVariant(styleOf())).toBe(false)
    expect(variantKey(styleOf())).toBe("")
  })

  test("an authored width keys the metrics without reaching the DOM", () => {
    const style = styleOf({ fontVariationSettings: '"wght" 600' })

    expect(usesVariant(style)).toBe(false)
    expect(variantKey(style)).toBe('fontVariationSettings:"wght" 600;')
  })

  test("the probe is told every property, neutral ones included", () => {
    expect(probeStyle(styleOf({ fontVariantCaps: "petite-caps" }))).toEqual([
      ["fontStretch", "100%"],
      ["fontVariationSettings", "normal"],
      ["fontVariantAlternates", "normal"],
      ["fontVariantCaps", "petite-caps"],
      ["fontVariantEastAsian", "normal"],
      ["fontVariantLigatures", "normal"],
      ["fontVariantNumeric", "normal"],
      ["fontVariantPosition", "normal"],
      ["fontFeatureSettings", "normal"],
    ])
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

describe("the letterspacing one line declaration can carry", () => {
  const readerOf = (values: readonly string[]) => {
    const elements = values.map((_, index) => ({ index }) as unknown as Element)
    const read = (element: Element) =>
      styleOf({
        letterSpacing: values[(element as unknown as { index: number }).index],
      })
    return { elements, read }
  }

  test("runs that all inherit the block's value are uniform", () => {
    const { elements, read } = readerOf(["normal", "normal", "normal"])

    expect(uniformLetterSpacing(elements, read, 0)).toBe(true)
  })

  test("runs that all carry the block's own value are uniform", () => {
    const { elements, read } = readerOf(["0.4px", "0.4px"])

    expect(uniformLetterSpacing(elements, read, 0.4)).toBe(true)
  })

  test("one run letterspaced differently is not", () => {
    const { elements, read } = readerOf(["normal", "1.5px", "normal"])

    expect(uniformLetterSpacing(elements, read, 0)).toBe(false)
  })

  test("no runs at all is vacuously uniform", () => {
    expect(uniformLetterSpacing([], () => styleOf(), 0)).toBe(true)
  })
})
