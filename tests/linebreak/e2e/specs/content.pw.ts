import { expect, test } from "@playwright/test"
import { invoke, openFixture } from "../support/fixture"

test("no-wrap extraction preserves break ownership", async ({ page }) => {
  await openFixture(page)

  expect(await invoke(page, "nowrapExtraction")).toEqual({
    collapsed: {
      text: "aaaa bbbb cccc dddd",
      items: [
        { kind: "text", start: 0, end: 10 },
        { kind: "anchor", start: 10, end: 10 },
        { kind: "text", start: 10, end: 19 },
      ],
      breakRestrictions: [
        { start: 1, end: 9 },
        { start: 11, end: 19 },
      ],
    },
    trailingSpace: {
      text: "aaaa bbbb",
      items: [
        { kind: "text", start: 0, end: 5 },
        { kind: "text", start: 5, end: 9 },
      ],
      breakRestrictions: [{ start: 1, end: 6 }],
    },
    emptyInline: {
      text: "aaaa\ufffcbbbb",
      items: [
        { kind: "text", start: 0, end: 4 },
        { kind: "box", start: 4, end: 5 },
        { kind: "text", start: 5, end: 9 },
      ],
      breakRestrictions: [{ start: 1, end: 9 }],
    },
  })
})

test("planning reads computed styles without redundant element lookups", async ({
  page,
}) => {
  await openFixture(page)

  const reads = await invoke(page, "styleReads")
  expect(reads.cachedParagraphs).toBe(1)
  expect(reads.unique).toBeGreaterThan(0)
  expect(reads.total).toBe(reads.unique)
  expect(reads.repeated).toBe(0)
  expect(reads.maximum).toBe(1)
})

test("computed display classifies inline text, atoms, and native fallback", async ({
  page,
}) => {
  await openFixture(page)

  const content = await invoke(page, "classifyInlineContent")
  expect(content.hidden?.text).not.toContain("hidden text")
  expect(content.contents?.wrapperTags).toContain("span")
  expect(content.inlineBoxes?.boxTags).toEqual(["span", "kbd"])
  expect(content.blockLink).toBeNull()
  expect(content.input).toBeNull()
  expect(content.customInline?.wrapperTags).toContain("linebreak-example")
  expect(content.nativeImage?.boxTags).toEqual(["img"])
  expect(content.nativeRenderers?.boxTags).toEqual([
    "svg",
    "math",
    "ruby",
    "span",
    "img",
  ])
  expect(content.nbsp?.text).toContain("This\u00a0pair")
  expect(content.nbsp?.text).toContain("thin\u2009space")
  expect(content.nbsp?.text).not.toMatch(/[\t\n\f\r]/u)
})

test("cached extraction and authored restoration share one detached template", async ({
  page,
}) => {
  await openFixture(page)

  const template = await invoke(page, "templateOwnership")
  expect(template.ownership).toEqual({
    cloneMatchesSource: true,
    distinctRoots: true,
    everyReferenceUsesTemplate: true,
    noReferenceUsesSource: true,
    wrappersResolve: true,
    directTextUsesTemplateRoot: true,
  })
  expect(template.behavior).toMatchObject({
    firstResult: { state: "typeset" },
    secondResult: { state: "typeset" },
    rendered: true,
    detachedWrappersRemainDetached: true,
    detachedMutationExcluded: true,
    restoredExactly: true,
  })
  expect(template.behavior.detachedWrapperCount).toBeGreaterThan(0)
})
