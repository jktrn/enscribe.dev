import { expect, test } from "@playwright/test"
import { settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const SPACING = 1

const ROUNDING = 1

const LIGATURES = '"liga" 1, "clig" 1'

const LIGATED = "The affluent office staff filed a final waffle briefing."

const PLAIN = "The quick brown dog jumps over a lazy modern typesetter."

type Probe = {
  readonly family: string
  readonly text: string
  readonly spacing: number
  readonly features: string
  readonly ligatures?: string
}

const advance = (page: import("@playwright/test").Page, probe: Probe) =>
  page.evaluate(async (spec: Probe) => {
    await document.fonts.load(`16px ${spec.family}`).catch(() => [])
    const span = document.createElement("span")
    span.style.cssText =
      "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre"
    span.style.font = `16px ${spec.family}`
    span.style.letterSpacing = `${spec.spacing}px`
    if (spec.features !== "") span.style.fontFeatureSettings = spec.features
    if (spec.ligatures) span.style.fontVariantLigatures = spec.ligatures
    span.textContent = spec.text
    document.body.appendChild(span)
    const width = span.getBoundingClientRect().width
    span.remove()
    return width
  }, probe)

const bodyFamily = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const block = document.querySelector("[data-linebreak-typeset]")
    if (!block) throw new Error("nothing was typeset")
    return getComputedStyle(block).fontFamily
  })

const letterspacedLines = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const lines = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-linebreak-typeset] > [data-linebreak-line]",
      ),
    ]
    return {
      lines: lines.length,
      letterspaced: lines.filter((line) => line.style.letterSpacing !== "")
        .length,
      featured: lines.filter((line) => line.style.fontFeatureSettings !== "")
        .length,
    }
  })

const units = (text: string) => [...text].length

const grew = async (
  page: import("@playwright/test").Page,
  family: string,
  text: string,
  features = "",
) => {
  const natural = await advance(page, {
    family,
    text,
    spacing: 0,
    features: "",
  })
  const spaced = await advance(page, {
    family,
    text,
    spacing: SPACING,
    features,
  })
  return spaced - natural
}

test.describe("letterfit tracking in a real browser", () => {
  test("a line grows by exactly the px per unit the renderer wrote", async ({
    page,
  }) => {
    await settleTypeset(page)

    for (const family of [await bodyFamily(page), '"IBM Plex Sans"']) {
      expect(await grew(page, family, PLAIN)).toBeCloseTo(
        SPACING * units(PLAIN),
        3,
      )
    }
  })

  test("letterspacing costs its own width plus the ligatures it dissolves", async ({
    page,
  }) => {
    await settleTypeset(page)

    for (const family of [await bodyFamily(page), '"IBM Plex Sans"']) {
      const natural = await advance(page, {
        family,
        text: LIGATED,
        spacing: 0,
        features: "",
      })
      const dissolved = await advance(page, {
        family,
        text: LIGATED,
        spacing: 0,
        features: "",
        ligatures: "none",
      })
      const growth = await grew(page, family, LIGATED)
      const ligatureCost = dissolved - natural

      expect(ligatureCost).toBeGreaterThanOrEqual(0)
      expect(growth).toBeGreaterThanOrEqual(SPACING * units(LIGATED) - 0.001)
      expect(
        Math.abs(growth - (SPACING * units(LIGATED) + ligatureCost)),
      ).toBeLessThanOrEqual(ROUNDING)
    }
  })

  test("a ligature guard would re-form them and lose a spacing each", async ({
    page,
  }) => {
    await settleTypeset(page)

    for (const family of [await bodyFamily(page), '"IBM Plex Sans"']) {
      const bare = await grew(page, family, LIGATED)
      const guarded = await grew(page, family, LIGATED, LIGATURES)

      expect(guarded).toBeLessThan(bare - SPACING)
    }
  })

  test("tracking is off, so no line asks for either declaration", async ({
    page,
  }) => {
    await settleTypeset(page)

    const rendered = await letterspacedLines(page)

    expect(rendered.lines).toBeGreaterThan(50)
    expect(rendered.letterspaced).toBe(0)
    expect(rendered.featured).toBe(0)
  })
})
