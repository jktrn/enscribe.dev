import { expect, test } from "@playwright/test"
import { invoke, openFixture } from "../support/fixture"

test("planning is non-mutating and one commit renders a rich batch", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "planBatch")).toBe(2)
  expect(await invoke(page, "snapshot")).toMatchObject({
    errors: [],
    rich: { typeset: false },
    richHtmlMatches: true,
    richLinkIdentity: true,
  })

  expect(await invoke(page, "commitBatch")).toMatchObject([
    { state: "typeset" },
    { state: "typeset" },
  ])
  const committed = await invoke(page, "snapshot")
  expect(committed.errors).toEqual([])
  expect(committed.rich).toMatchObject({
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
  expect(committed.rich.lineCount).toBeGreaterThan(1)
  expect(committed.japanese).toMatchObject({
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
  expect(committed.japanese.lineCount).toBeGreaterThan(1)
  expect(committed.richLinkIdentity).toBe(false)
  expect(committed.rich.html).toContain('href="#kept"')
  expect(committed.rich.html).toContain('data-linebreak-atom=""')
})

test("native reasons and width-stale plans are observable", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "fallbackResults")).toEqual([
    { reason: "unsupported-direction", state: "native" },
    { reason: "unsupported-content", state: "native" },
    { reason: "insufficient-width", state: "native" },
  ])
  expect(await invoke(page, "planStale")).toMatchObject({
    html: expect.any(String),
  })
  expect(await invoke(page, "commitStale")).toMatchObject({
    authored: true,
    result: { state: "stale" },
    typeset: false,
  })
  expect(await invoke(page, "replanStale")).toMatchObject({ state: "typeset" })
  expect(await invoke(page, "generationStale")).toEqual([
    { state: "stale" },
    { state: "stale" },
  ])
})

test("plans are instance-owned and duplicate batches render once", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "foreignPlan")).toMatchObject({
    authored: true,
    result: { state: "stale" },
    typeset: false,
  })
  const duplicate = await invoke(page, "duplicateBatch")
  expect(duplicate.results).toEqual([
    expect.objectContaining({ state: "typeset" }),
    expect.objectContaining({ state: "stale" }),
  ])
  expect(duplicate).toMatchObject({
    overflow: 0,
    typeset: true,
    wrappedLines: 0,
  })
  expect(duplicate.maximumResidual).toBeLessThanOrEqual(1)
})
