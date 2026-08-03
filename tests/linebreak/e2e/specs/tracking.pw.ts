import { expect, test } from "@playwright/test"
import { settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const SPACING = 1

const LIGATURES = '"liga" 1, "clig" 1'

const LIGATED = "The affluent office staff filed a final waffle briefing."

const PLAIN = "The quick brown dog jumps over a lazy modern typesetter."

type Probe = {
  readonly family: string
  readonly text: string
  readonly spacing: number
  readonly features: string
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

  /**
   * The advances were measured with ligatures on, and letterspacing suppresses
   * them. It costs nothing: the suppressed text sets to the same total, so the
   * growth is still the whole per-unit spacing. One unit of slack is allowed
   * for a face that keeps a contextual cluster under spacing anyway.
   */
  test("suppressed ligatures cost the model at most one unit", async ({
    page,
  }) => {
    await settleTypeset(page)

    for (const family of [await bodyFamily(page), '"IBM Plex Sans"']) {
      const growth = await grew(page, family, LIGATED)

      expect(growth).toBeLessThanOrEqual(SPACING * units(LIGATED) + 0.001)
      expect(growth).toBeGreaterThan(SPACING * (units(LIGATED) - 2))
    }
  })

  /** Why the renderer does NOT write a ligature guard: asking for the common
   * ligatures back re-forms them, and a ligature glyph takes one spacing where
   * its characters would have taken two or three. */
  test("asking the ligatures back is what would break the model", async ({
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
