import { expect, test } from "@playwright/test"
import { invoke, openFixture } from "../support/fixture"

test("stabilization refreshes line references without rediscovering them", async ({
  page,
}) => {
  await openFixture(page)

  const rendered = await invoke(page, "renderedLineReferences")
  expect(rendered.result).toMatchObject({ state: "typeset" })
  expect(rendered.detachedLines).toBeGreaterThan(0)
  expect(rendered.finalLineCount).toBe(rendered.result.lineCount)
  expect(rendered.lineSelectors).toEqual([])
  expect(rendered.overflow).toBeLessThanOrEqual(1)
})

test("intrinsic table columns stabilize inside one atomic commit", async ({
  page,
}) => {
  await openFixture(page)

  const table = await invoke(page, "intrinsicTable")
  expect(table.results).toEqual([
    expect.objectContaining({ state: "typeset" }),
    expect.objectContaining({ state: "typeset" }),
  ])
  expect(table.header).toMatchObject({
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
  expect(table.cell).toMatchObject({
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
})

test("configured locale and diagnostic failures retain native fallback", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "localeFallback")).toMatchObject({
    result: { state: "typeset" },
    typeset: true,
    wrappedLines: 0,
  })
  const switching = await invoke(page, "localeSwitching")
  expect(switching.locales).toEqual(["fr", "th", "fr"])
  expect(switching.results[1]).toMatchObject({ state: "typeset" })
  expect(switching.results.every(({ state }) => state !== "stale")).toBe(true)
  expect(await invoke(page, "diagnosticIsolation")).toEqual({
    reason: "unsupported-content",
    state: "native",
  })
})

test("typesetting preserves vertical geometry and fits each line", async ({
  page,
}) => {
  await openFixture(page)

  const geometry = await invoke(page, "typesetGeometry")
  expect(geometry.result).toMatchObject({ state: "typeset" })
  expect(geometry.after).toMatchObject({
    computedLineHeight: geometry.before.computedLineHeight,
    nativeLineHeight: geometry.before.nativeLineHeight,
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
  expect(
    Math.abs(geometry.after.projectedPitch - geometry.before.nativePitch),
  ).toBeLessThanOrEqual(0.1)
  expect(geometry.after.maximumResidual).toBeLessThanOrEqual(1)
})

test("authored paragraph spacing remains the base for line adjustments", async ({
  page,
}) => {
  await openFixture(page)

  const spacing = await invoke(page, "authoredSpacing")
  expect(spacing.result).toMatchObject({ state: "typeset" })
  expect(spacing.lineCount).toBeGreaterThan(1)
  expect(spacing.final).toEqual(spacing.base)
  expect(spacing.lineHeight).toBe(spacing.nativeLineHeight)
  expect(Math.abs(spacing.pitch - Number.parseFloat(spacing.lineHeight))).toBe(
    0,
  )
  expect(spacing.maximumCompositionError).toBeLessThanOrEqual(0.01)
  expect(spacing.overflow).toBeLessThanOrEqual(1)
})

test("preformatted inline whitespace uses native layout", async ({ page }) => {
  await openFixture(page)

  expect(await invoke(page, "preformattedCodeFallback")).toEqual([
    {
      authored: true,
      result: { reason: "unsupported-content", state: "native" },
      typeset: false,
    },
    {
      authored: true,
      result: { reason: "unsupported-content", state: "native" },
      typeset: false,
    },
    {
      authored: true,
      result: { reason: "unsupported-content", state: "native" },
      typeset: false,
    },
  ])
})

test("collapsed no-wrap content remains indivisible", async ({ page }) => {
  await openFixture(page)

  const layout = await invoke(page, "nowrapInlineLayout")
  expect(layout.result.reason).toBeUndefined()
  expect(layout.result).toMatchObject({ state: "typeset" })
  expect(layout.typeset).toBe(true)
  expect(layout.lineCount).toBeGreaterThan(1)
  expect(layout.lineIndex).toBeGreaterThan(0)
  expect(layout.lineIndex).toBeLessThan(layout.lineCount - 1)
  expect(layout.fragments).toBe(1)
  expect(layout.fragmentRects).toBe(1)
  expect(layout.fragmentStart).toBe(true)
  expect(layout.fragmentEnd).toBe(true)
  expect(layout.overflow).toBeLessThanOrEqual(1)
  expect(layout.restored).toBe(true)
})

test("no-wrap follows CSS ownership boundaries", async ({ page }) => {
  await openFixture(page)

  expect(await invoke(page, "nowrapOwnershipLayouts")).toEqual({
    atomic: {
      result: { reason: "infeasible", state: "native" },
      typeset: false,
      overflow: expect.any(Number),
    },
    collapsed: {
      result: { lineCount: 2, state: "typeset" },
      typeset: true,
      overflow: 0,
    },
    trailingSpace: {
      result: { reason: "infeasible", state: "native" },
      typeset: false,
      overflow: expect.any(Number),
    },
    emptyInline: {
      result: { reason: "infeasible", state: "native" },
      typeset: false,
      overflow: expect.any(Number),
    },
    restored: true,
  })
})

test("collapsed spaces trim without discarding inline edges", async ({
  page,
}) => {
  await openFixture(page)

  const layouts = await invoke(page, "nowrapEdgeLayouts")
  for (const layout of [layouts.sole, layouts.duplicate]) {
    expect(layout.result).toEqual({ lineCount: 2, state: "typeset" })
    expect(layout.edgeLine).toBe(0)
    expect(layout.edgeWidth).toBeCloseTo(layout.nativeEdgeWidth, 3)
    expect(layout.overflow).toBeLessThanOrEqual(1)
  }
  expect(layouts.restored).toBe(true)
})

test("automatic hyphenation and copy cleanup preserve authored text", async ({
  page,
}) => {
  await openFixture(page)

  const hyphenated = await invoke(page, "typesetHyphen")
  expect(hyphenated.result).toMatchObject({ state: "typeset" })
  expect(hyphenated.selectedHyphens).toBeGreaterThan(0)
  expect(hyphenated.codeHyphens).toBe(0)
  expect(hyphenated.copy.text).toBe(hyphenated.sourceText)
  expect(hyphenated.copy.html).toContain("<strong")
  expect(hyphenated.copy.html).toContain("<code")
  expect(hyphenated.copy.html).not.toMatch(
    /kp-line|kp-break|kp-hyphen|data-kp-/u,
  )
})

test("English hyphenation patterns stay out of other languages", async ({
  page,
}) => {
  await openFixture(page)

  const hyphenation = await invoke(page, "typesetNonEnglishHyphen")
  expect(hyphenation.ancestorEnglishHyphens).toBeGreaterThan(0)
  expect(hyphenation.ancestorFrenchHyphens).toBe(0)
  expect(hyphenation.documentEnglishHyphens).toBeGreaterThan(0)
  expect(hyphenation.documentUnknownHyphens).toBe(0)
  expect(hyphenation.elementEnglishHyphens).toBeGreaterThan(0)
  expect(hyphenation.elementUnknownHyphens).toBe(0)
  expect(hyphenation.results.every(({ state }) => state !== "stale")).toBe(true)
})

test("advanced typography uses the narrowest accurate measurement path", async ({
  page,
}) => {
  await openFixture(page)
  await page.evaluate(() => document.fonts.ready)

  const measurement = await invoke(page, "typographyMeasurement")
  expect(measurement.plain.firstExactRetries).toBe(0)
  expect(measurement.correctableWordSpacing.firstExactRetries).toBe(0)
  expect(measurement.wordSpacing.firstExactRetries).toBe(0)
  expect(measurement.uppercase.firstExactRetries).toBe(0)

  for (const [name, typography] of Object.entries(measurement)) {
    const firstCase = `${name}: ${JSON.stringify(typography.first)}`
    const secondCase = `${name}: ${JSON.stringify(typography.second)}`
    expect(typography.first, firstCase).toMatchObject({ state: "typeset" })
    expect(typography.second, secondCase).toMatchObject({ state: "typeset" })
    expect(typography.invalidated, name).toMatchObject({ state: "typeset" })
    expect(typography.firstExactRetries, name).toBeLessThanOrEqual(1)
    expect(typography.secondExactRetries, name).toBe(0)
    expect(typography.invalidatedExactRetries, name).toBe(
      typography.firstExactRetries,
    )
    expect(typography.remainingMeasurementHosts, name).toBe(0)
    expect(typography.geometry, name).toMatchObject({
      overflow: 0,
      typeset: true,
      wrappedLines: 0,
    })
    expect(typography.geometry.maximumResidual).toBeLessThanOrEqual(1)
  }
})
