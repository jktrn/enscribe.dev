import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createTypesetter } from "@linebreak/auto"
import * as engineModule from "@linebreak/linebreaker"
import type { Outcome } from "@linebreak/types"
import { ElementSize, Viewport } from "./support/observers"
import {
  autoFixture,
  restoreAutoFixture,
  engine,
  fontEvents,
  blocks,
  common,
  frame,
} from "./support/auto"

beforeEach(autoFixture)
afterEach(restoreAutoFixture)

test("start discovers once, batches work and resolves settled only after the last slice", async () => {
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 1, sliceMs: 100 },
  })
  expect(setter.stats().running).toBe(false)
  await setter.start()
  await setter.start()
  expect(engine.warm).toHaveBeenCalledTimes(1)
  expect(setter.stats()).toMatchObject({
    discovered: 3,
    queued: 3,
    running: true,
    slices: 0,
  })
  const settled = vi.fn()
  void setter.settled.then(settled)
  await frame()
  expect(setter.stats()).toMatchObject({ queued: 2, slices: 1 })
  expect(settled).not.toHaveBeenCalled()
  await frame()
  await frame()
  await setter.settled
  expect(settled).toHaveBeenCalledOnce()
  expect(engine.typeset).toHaveBeenCalledTimes(3)
  setter.dispose()
  setter.dispose()
  expect(engine.dispose).toHaveBeenCalledOnce()
  await expect(setter.start()).rejects.toThrow("disposed")
})

test("stop cancels queued work, restores originals and permits restarting", async () => {
  const setter = createTypesetter(common)
  setter.refresh()
  setter.rescan()
  expect(setter.stats().discovered).toBe(0)
  await setter.start()
  const pending = setter.settled
  setter.stop()
  await pending
  await frame()
  expect(engine.typeset).not.toHaveBeenCalled()
  expect(setter.stats()).toMatchObject({
    running: false,
    queued: 0,
    discovered: 0,
  })
  await setter.start()
  await frame()
  expect(engine.typeset).toHaveBeenCalledOnce()
})

test("manual work drains the queue and empty requests do no work", async () => {
  const setter = createTypesetter(common)
  expect(setter.typeset()).toEqual([])
  await setter.start()
  expect(setter.typeset([blocks()[0]!])).toHaveLength(1)
  expect(setter.stats().queued).toBe(2)
  expect(setter.typeset()).toHaveLength(2)
  await frame()
  await setter.settled
  expect(engine.typeset).toHaveBeenCalledTimes(2)
})

test("refresh requeues connected paragraphs and rescan forgets detached ones", async () => {
  const setter = createTypesetter(common)
  await setter.start()
  await frame()
  blocks()[0]?.remove()
  setter.rescan()
  expect(setter.stats().discovered).toBe(2)
  setter.refresh()
  await frame()
  expect(engine.refresh).toHaveBeenCalledOnce()
  expect(engine.typeset.mock.lastCall?.[0]).toHaveLength(2)
})

test("lazy layout only enqueues intersecting paragraphs and honors custom margin", async () => {
  const setter = createTypesetter({ ...common, lazy: { margin: "25px" } })
  await setter.start()
  const viewport = Viewport.latest
  expect(viewport.rootMargin).toBe("25px")
  expect(viewport.watched.size).toBe(3)
  expect(setter.stats().queued).toBe(0)
  const p = blocks()[0]!
  viewport.emit(p, true)
  await frame()
  expect(engine.typeset.mock.lastCall?.[0]).toEqual([p])
  viewport.emit(p, false)
  setter.refresh()
  expect(setter.stats().queued).toBe(0)
  setter.stop()
  viewport.emit(p, true)
  expect(setter.stats().queued).toBe(0)
})

test("default root selection and discovery filter work", async () => {
  const setter = createTypesetter({
    fonts: false,
    resize: false,
    lazy: false,
    copy: false,
    print: false,
    filter: (p) => p.textContent?.startsWith("Two") === true,
  })
  await setter.start()
  await frame()
  expect(setter.stats().discovered).toBe(1)
  setter.dispose()
  const empty = createTypesetter({ ...common, roots: ".missing" })
  await empty.start()
  expect(empty.stats().discovered).toBe(0)
  const explicit = createTypesetter({
    ...common,
    roots: [document.querySelector("article")!],
  })
  await explicit.start()
  expect(explicit.stats().discovered).toBe(3)
})

test("resize debounces changes, ignores first observations, and requeues after settling", async () => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  await frame()
  const p = blocks()[0]!,
    resize = ElementSize.latest
  expect(resize.watched.size).toBe(3)
  resize.emit(p, 300)
  resize.emit(p, 300.1, false)
  expect(engine.refresh).not.toHaveBeenCalled()
  resize.emit(p, 400)
  resize.emit(p, 450)
  await vi.advanceTimersByTimeAsync(149)
  expect(engine.refresh).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(18)
  expect(engine.refresh).toHaveBeenCalledOnce()
  expect(engine.typeset).toHaveBeenCalledTimes(2)
  setter.stop()
  resize.emit(p, 500)
  await vi.advanceTimersByTimeAsync(200)
  expect(engine.refresh).toHaveBeenCalledOnce()
})

test("stopping during resize debounce permits fresh work after restart", async () => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  await frame()
  ElementSize.latest.emit(blocks()[0]!, 300)
  ElementSize.latest.emit(blocks()[0]!, 400)
  setter.stop()
  await setter.start()
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(2)
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("rescan releases detached elements from both observers", async () => {
  const setter = createTypesetter({ ...common, lazy: true, resize: true })
  await setter.start()
  const p = blocks()[0]!
  p.remove()
  setter.rescan()
  expect(Viewport.latest.watched.has(p)).toBe(false)
  expect(ElementSize.latest.watched.has(p)).toBe(false)
  setter.dispose()
})

test("a throwing failure reporter still schedules later work and settles", async () => {
  const report = vi.fn().mockImplementationOnce(() => {
    throw new Error("reporter failed")
  })
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 1 },
    onOutcome: report,
  })
  engine.typeset.mockImplementationOnce(() => {
    throw new Error("layout failed")
  })
  await setter.start()
  await expect(frame()).rejects.toThrow("reporter failed")
  await frame()
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(3)
  expect(setter.stats().queued).toBe(0)
  await setter.settled
  setter.dispose()
})

test("an outcome callback exception is delivered once and cannot strand the queue", async () => {
  const report = vi.fn().mockImplementationOnce(() => {
    throw new Error("callback failed")
  })
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 1 },
    onOutcome: report,
  })
  const options = vi.mocked(engineModule.createLinebreaker).mock.lastCall?.[0]
  engine.typeset.mockImplementationOnce((elements) => {
    const outcome: Outcome = {
      element: [...elements][0]!,
      status: "skipped",
      reason: "single-line",
    }
    options?.onOutcome?.(outcome)
    return [outcome]
  })
  await setter.start()
  await expect(frame()).rejects.toThrow("callback failed")
  await frame()
  await frame()
  expect(report).toHaveBeenCalledTimes(3)
  expect(engine.typeset).toHaveBeenCalledTimes(3)
  await setter.settled
  setter.dispose()
})

test("successful automatic outcome delivery leaves later failures reportable", async () => {
  const report = vi.fn()
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 1 },
    onOutcome: report,
  })
  const options = vi.mocked(engineModule.createLinebreaker).mock.lastCall?.[0]
  engine.typeset
    .mockImplementationOnce((elements) => {
      const outcome: Outcome = {
        element: [...elements][0]!,
        status: "skipped",
        reason: "single-line",
      }
      options?.onOutcome?.(outcome)
      return [outcome]
    })
    .mockImplementationOnce(() => {
      throw new Error("layout failed")
    })
  await setter.start()
  await frame()
  await frame()
  await frame()
  expect(report).toHaveBeenCalledTimes(3)
  expect(report.mock.calls[1]?.[0]).toMatchObject({ status: "failed" })
  setter.dispose()
})

test("printing pauses updates and resumes afterward with balanced hooks", async () => {
  const before = vi.fn(() => "token"),
    after = vi.fn()
  const setter = createTypesetter({
    ...common,
    print: true,
    beforeWrite: before,
    afterWrite: after,
  })
  await setter.start()
  dispatchEvent(new Event("beforeprint"))
  await frame()
  expect(engine.typeset).not.toHaveBeenCalled()
  dispatchEvent(new Event("afterprint"))
  await frame()
  expect(engine.typeset).toHaveBeenCalledOnce()
  expect(after.mock.calls.every(([token]) => token === "token")).toBe(true)
  expect(before).toHaveBeenCalledTimes(after.mock.calls.length)
  setter.dispose()
})

test("font loading invalidates only when measured advances change", async () => {
  const setter = createTypesetter({ ...common, fonts: true })
  await setter.start()
  await frame()
  fontEvents.dispatchEvent(new Event("loadingdone"))
  expect(engine.reset).not.toHaveBeenCalled()
  engine.fontsMoved.mockReturnValue(true)
  fontEvents.dispatchEvent(new Event("loadingdone"))
  await frame()
  expect(engine.reset).toHaveBeenCalledOnce()
  setter.stop()
  fontEvents.dispatchEvent(new Event("loadingdone"))
  expect(engine.reset).toHaveBeenCalledOnce()
  setter.dispose()
})

test("stop while fonts are pending prevents stale startup", async () => {
  let resolveFonts: () => void = () => {}
  Object.defineProperty(document, "fonts", {
    value: Object.assign(new EventTarget(), {
      ready: new Promise<void>((resolve) => {
        resolveFonts = resolve
      }),
    }),
    configurable: true,
  })
  const setter = createTypesetter({ ...common, fonts: true })
  const starting = setter.start()
  setter.stop()
  resolveFonts()
  await starting
  expect(engine.warm).not.toHaveBeenCalled()
  expect(setter.stats().running).toBe(false)
})

test("aborting disposes the typesetter and removes global listeners", async () => {
  const signal = new AbortController()
  const setter = createTypesetter({
    ...common,
    signal: signal.signal,
    print: true,
    copy: true,
  })
  await setter.start()
  signal.abort()
  await frame()
  expect(engine.dispose).toHaveBeenCalledOnce()
  expect(setter.stats().running).toBe(false)
})

test("a failed slice reports once, balances hooks, and lets later slices continue", async () => {
  const report = vi.fn(),
    after = vi.fn()
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 1 },
    onOutcome: report,
    beforeWrite: () => 42,
    afterWrite: after,
  })
  engine.typeset
    .mockImplementationOnce(() => {
      throw new Error("broken")
    })
    .mockImplementationOnce(() => {
      throw "broken"
    })
  await setter.start()
  await frame()
  await frame()
  await frame()
  await setter.settled
  expect(report).toHaveBeenCalledTimes(3)
  expect(
    report.mock.calls
      .filter(([outcome]) => outcome.status === "failed")
      .every(([outcome]) => outcome.cause instanceof Error),
  ).toBe(true)
  expect(engine.typeset).toHaveBeenCalledTimes(3)
  expect(after).toHaveBeenCalledTimes(4)
  expect(report.mock.calls[0]?.[0]).toMatchObject({
    element: blocks()[0], status: "failed", reason: "render-failed",
    cause: new Error("broken"),
  })
  expect(report.mock.calls[1]?.[0]).toMatchObject({
    element: blocks()[1], status: "failed", reason: "render-failed",
    cause: new Error("Automatic layout threw a non-Error value"),
  })
})

test("refresh does not requeue disconnected paragraphs even before a rescan", async () => {
  const setter = createTypesetter(common)
  await setter.start()
  await frame()
  blocks()[0]?.remove()
  setter.refresh()
  expect(setter.stats().queued).toBe(2)
})

test.each([
  true,
  {},
  undefined,
])("default lazy margin applies to %j", async (lazy) => {
  const setter = createTypesetter({ ...common, lazy })
  await setter.start()
  expect(Viewport.latest.rootMargin).toBe("200% 0px")
  setter.dispose()
})

test("elapsed frame budget yields before the next paragraph", async () => {
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 20, sliceMs: 1 },
  })
  await setter.start()
  let time = 0
  vi.spyOn(performance, "now").mockImplementation(() => ++time * 2)
  await frame()
  expect(setter.stats().queued).toBe(2)
})

test("a signal aborted before construction cannot start new work", async () => {
  const abort = new AbortController()
  abort.abort()
  const setter = createTypesetter({ ...common, signal: abort.signal })
  await expect(setter.start()).rejects.toThrow("disposed")
  expect(engine.dispose).toHaveBeenCalledOnce()
})

test.each([
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  1.5,
])("invalid block budget %j is rejected", (blocksPerSlice) => {
  expect(() =>
    createTypesetter({ ...common, budget: { blocksPerSlice } }),
  ).toThrow(new RangeError("linebreak: blocksPerSlice must be a positive integer"))
})

test.each([
  0,
  -1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
])("invalid frame budget %j is rejected", (sliceMs) => {
  expect(() => createTypesetter({ ...common, budget: { sliceMs } })).toThrow(
    new RangeError("linebreak: sliceMs must be a finite positive number"),
  )
})
