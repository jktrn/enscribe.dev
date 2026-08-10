import { expect, test } from "@playwright/test"
import {
  calibrateStretch,
  narrowestRatio,
  widestRatio,
} from "@linebreak/text/stretch"
import { settleTypeset } from "../support/page"

test.use({ viewport: { width: 1440, height: 900 } })

const BUDGET = 0.02

const PROBE_PERCENTS = [
  94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106,
]

const advances = (page: import("@playwright/test").Page, family: string) =>
  page.evaluate(
    async ({ family: name, ladder }) => {
      await document.fonts.load(`16px ${name}`).catch(() => [])
      const probe = document.createElement("span")
      probe.style.cssText =
        "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre"
      probe.style.font = `16px ${name}`
      probe.textContent =
        "Hamburgefonstiv the quick brown fox jumps over a lazy dog, 0123456789"
      document.body.appendChild(probe)

      const widths: Record<number, number> = {}
      for (const pct of ladder) {
        probe.style.fontStretch = `${pct}%`
        widths[pct] = probe.getBoundingClientRect().width
      }
      probe.remove()
      return widths
    },
    { family, ladder: PROBE_PERCENTS },
  )

const bodyFamily = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const block = document.querySelector("[data-linebreak-typeset]")
    if (!block) throw new Error("nothing was typeset")
    return getComputedStyle(block).fontFamily
  })

const stretched = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const lines = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-linebreak-typeset] > [data-linebreak-line]",
      ),
    ]
    return {
      lines: lines.length,
      stretched: lines.filter((line) => line.style.fontStretch !== "").length,
    }
  })

test.describe("font expansion in a real browser", () => {
  test("the body face declines the axis, so no line is set at a percentage", async ({
    page,
  }) => {
    await settleTypeset(page)

    const widths = await advances(page, await bodyFamily(page))
    const moved = Math.abs((widths[106] as number) - (widths[94] as number))

    expect(moved).toBe(0)
    expect(calibrateStretch(BUDGET, (pct) => widths[pct] as number)).toBeNull()

    const rendered = await stretched(page)
    expect(rendered.lines).toBeGreaterThan(50)
    expect(rendered.stretched).toBe(0)
  })

  test("a font that does carry one calibrates to the width it delivers", async ({
    page,
  }) => {
    await settleTypeset(page)

    const widths = await advances(page, '"IBM Plex Sans"')
    const scale = calibrateStretch(BUDGET, (pct) => widths[pct] as number)

    expect(scale).not.toBeNull()
    if (!scale) return

    expect(narrowestRatio(scale)).toBeLessThan(1)
    expect(widestRatio(scale)).toBeGreaterThanOrEqual(1)

    const percentages = scale.steps.map((step) => step.pct)
    const ratios = scale.steps.map((step) => step.ratio)
    expect(percentages).toEqual([...percentages].sort((a, b) => a - b))
    expect(new Set(ratios).size).toBe(ratios.length)
    const base = widths[100] as number
    for (const step of scale.steps) {
      expect(step.ratio).toBeCloseTo((widths[step.pct] as number) / base, 9)
    }
  })
})
