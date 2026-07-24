import { expect, test } from "@playwright/test"
import { invoke, openFixture } from "../support/fixture"

test("language changes restore authored styles before measurement", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "languageChangeRestoresBeforeMeasurement")).toEqual(
    [{ fontSize: "18px", justified: false }],
  )
})

test("plan handles are private, single-use capabilities", async ({ page }) => {
  await openFixture(page)

  expect(await invoke(page, "planLifecycle")).toMatchObject({
    publicKeys: ["element"],
    foreign: { state: "stale" },
    owner: expect.objectContaining({ state: "typeset" }),
    replay: { state: "stale" },
    freshResults: {
      owner: true,
      replay: true,
      batch: true,
      postDestroy: true,
    },
    samePlanBatch: [
      expect.objectContaining({ state: "typeset" }),
      { state: "stale" },
    ],
    postDestroy: { reason: "destroyed", state: "native" },
  })
})

test("restore, invalidate, and destroy have explicit clone semantics", async ({
  page,
}) => {
  await openFixture(page)

  const lifecycle = await invoke(page, "lifecycle")
  expect(lifecycle.beforeRestoreCache).toBe(1)
  expect(lifecycle.restored).toMatchObject({
    cache: 1,
    html: lifecycle.authoredHtml,
    identity: false,
  })
  expect(lifecycle.updatedResult).toMatchObject({ state: "typeset" })
  expect(lifecycle.destroyed).toMatchObject({
    cache: 0,
    html: lifecycle.updatedHtml,
    result: { reason: "destroyed", state: "native" },
  })
})

test("restore and invalidate batch their shared lifecycle work", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "batchLifecycle")).toEqual({
    afterRestore: {
      authored: true,
      cache: 3,
      pending: { state: "stale" },
    },
    afterInvalidate: {
      authored: true,
      cache: 1,
      pending: { state: "stale" },
    },
    emptyInvalidate: expect.objectContaining({ state: "typeset" }),
    emptyRestore: expect.objectContaining({ state: "typeset" }),
    fresh: [
      expect.objectContaining({ state: "typeset" }),
      expect.objectContaining({ state: "typeset" }),
    ],
  })
})

test("batch invalidation preserves an unprocessed authored template after failure", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "batchLifecycleFailure")).toEqual({
    afterFailure: {
      cache: 1,
      error: "forced restoration failure",
      failingTypeset: true,
      iteratorClosed: true,
      pending: { state: "stale" },
      processedAuthored: true,
    },
    afterRetry: {
      authored: true,
      cache: 0,
    },
  })
})

test("post-render settlement preserves width and minimum invariants", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "minimumWidthAfterRender")).toEqual({
    authored: true,
    result: expect.objectContaining({
      reason: "insufficient-width",
      state: "native",
    }),
    typeset: false,
  })
  expect(await invoke(page, "settlementRevalidation")).toEqual({
    authored: true,
    results: [
      expect.objectContaining({ state: "stale" }),
      expect.objectContaining({ reason: "render-failed", state: "native" }),
    ],
    typeset: false,
  })
})

test("a post-render geometry failure is isolated to its paragraph", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "stabilizationFailureIsolation")).toEqual({
    errors: [
      {
        element: "stale-owner",
        message: "forced post-render geometry failure",
        phase: "render",
      },
    ],
    results: [
      expect.objectContaining({ state: "typeset" }),
      expect.objectContaining({ reason: "render-failed", state: "native" }),
    ],
    stableTypeset: true,
    failingTypeset: false,
  })
})

test("duplicate image sources preserve independent runtime state", async ({
  page,
}) => {
  await openFixture(page)

  expect(await invoke(page, "imageLifecycle")).toEqual({
    rendered: ["first", "second"],
    restored: ["rendered-first", "rendered-second"],
    result: expect.objectContaining({ state: "typeset" }),
  })
})
