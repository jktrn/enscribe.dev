import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { COMPOSITION_BRAND, type Composition } from "@linebreak/types"
import { createTypesetter } from "@linebreak/auto"
import * as engineModule from "@linebreak/linebreaker"
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

test("automatic orchestration forwards all configured typography and owns outcome delivery", () => {
  const hyphenate = () => [3]
  const onOutcome = vi.fn()
  const setter = createTypesetter({
    ...common,
    minimumWidth: 197,
    safetyMargin: 1.75,
    retries: 2,
    maximumCharacters: 1200,
    locale: "fr",
    hyphenate,
    onOutcome,
    protrude: false,
    expand: true,
    track: true,
    lastLineMinWidth: 0.25,
    emergencyStretch: 17,
    policy: { hyphenPenalty: 83 },
    glue: { shrink: 0.2 },
    preserveImageAttributes: ["src"],
  })
  expect(engineModule.createLinebreaker).toHaveBeenCalledWith(
    expect.objectContaining({
      minimumWidth: 197,
      safetyMargin: 1.75,
      retries: 2,
      maximumCharacters: 1200,
      locale: "fr",
      hyphenate,
      onOutcome: undefined,
      protrude: false,
      expand: true,
      track: true,
      lastLineMinWidth: 0.25,
      emergencyStretch: 17,
      policy: { hyphenPenalty: 83 },
      glue: { shrink: 0.2 },
      preserveImageAttributes: ["src"],
    }),
  )
  setter.dispose()
})

test("stopped refresh has no engine side effects", () => {
  const setter = createTypesetter(common)
  setter.refresh()
  expect(engine.restore).not.toHaveBeenCalled()
  expect(engine.refresh).not.toHaveBeenCalled()
  setter.dispose()
})

test("an empty block provider cannot add a phantom work item", async () => {
  const setter = createTypesetter({ ...common, blocks: () => [] })
  await setter.start()
  await frame()
  expect(setter.stats()).toMatchObject({ discovered: 0, queued: 0, slices: 0 })
  expect(engine.typeset).not.toHaveBeenCalled()
  setter.dispose()
})

test("stop clears lazy visibility before starting the same elements again", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  Viewport.latest.emit(blocks()[0]!, true)
  await frame()
  setter.stop()
  await setter.start()
  setter.refresh()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("leaving the viewport removes a paragraph from later refresh targets", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  Viewport.latest.emit(blocks()[0]!, true)
  await frame()
  Viewport.latest.emit(blocks()[0]!, false)
  setter.refresh()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("disabled resize never creates an observer", async () => {
  const constructor = vi.fn(
    (callback: ResizeObserverCallback) => new ElementSize(callback),
  )
  vi.stubGlobal("ResizeObserver", constructor)
  const setter = createTypesetter(common)
  await setter.start()
  expect(constructor).not.toHaveBeenCalled()
  setter.dispose()
})

test("the first observed width establishes a baseline without restoring layout", async () => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  ElementSize.latest.emit(blocks()[0]!, 300)
  expect(engine.restore).not.toHaveBeenCalled()
  setter.dispose()
})

test("print restoration clears resize pause so printing can finish without its timer", async () => {
  const setter = createTypesetter({ ...common, resize: true, print: true })
  await setter.start()
  await frame()
  ElementSize.latest.emit(blocks()[0]!, 300)
  ElementSize.latest.emit(blocks()[0]!, 350)
  dispatchEvent(new Event("beforeprint"))
  expect(engine.restore).toHaveBeenCalledTimes(2)
  dispatchEvent(new Event("afterprint"))
  expect(setter.stats().queued).toBe(3)
  await frame()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("font and print listeners belong to an aborted lifecycle signal after disposal", async () => {
  const fontListen = vi.spyOn(fontEvents, "addEventListener")
  const windowListen = vi.spyOn(globalThis, "addEventListener")
  const setter = createTypesetter({ ...common, fonts: true, print: true })
  await setter.start()
  const registrations = [
    ...fontListen.mock.calls,
    ...windowListen.mock.calls,
  ].filter(([event]) =>
    ["loadingdone", "beforeprint", "afterprint"].includes(event),
  )
  expect(registrations).toHaveLength(3)
  const signals = registrations.map(([, , options]) =>
    typeof options === "object" ? options?.signal : undefined,
  )
  expect(
    signals.every((signal) => signal instanceof AbortSignal && !signal.aborted),
  ).toBe(true)
  setter.dispose()
  expect(signals.every((signal) => signal?.aborted)).toBe(true)
})

test.each([6, 10])("a %jms composition reaches the frame budget before selecting the next block", async (duration) => {
  let time = 0
  vi.spyOn(performance, "now").mockImplementation(() => time)
  engine.compose.mockImplementation((elements) => {
    const composed: Composition[] = []
    for (const element of elements) {
      time += duration
      composed.push({
        brand: COMPOSITION_BRAND,
        element,
        status: "ready",
        lines: 2,
        width: 300,
      })
    }
    return composed
  })
  const setter = createTypesetter({
    ...common,
    budget: { blocksPerSlice: 12, sliceMs: 6 },
  })
  await setter.start()
  await frame()
  expect(setter.stats()).toMatchObject({ queued: 2, slices: 1 })
  expect(engine.typeset).toHaveBeenLastCalledWith([blocks()[0]])
  await frame()
  expect(setter.stats().queued).toBe(1)
  await frame()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("visible paragraphs are queued again after their first layout settles", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  Viewport.latest.emit(blocks()[0]!, true)
  await frame()
  expect(setter.stats().queued).toBe(0)
  setter.refresh()
  expect(setter.stats().queued).toBe(1)
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(2)
  expect(engine.typeset).toHaveBeenLastCalledWith([blocks()[0]])
  setter.dispose()
})

test("font changes schedule a fresh layout for settled visible paragraphs", async () => {
  const setter = createTypesetter({ ...common, fonts: true, lazy: true })
  await setter.start()
  Viewport.latest.emit(blocks()[0]!, true)
  await frame()
  engine.fontsMoved.mockReturnValue(true)
  fontEvents.dispatchEvent(new Event("loadingdone"))
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(2)
  expect(engine.typeset).toHaveBeenLastCalledWith([blocks()[0]])
  setter.dispose()
})

test("printing cancels a pending resize refresh until printing has finished", async () => {
  const setter = createTypesetter({ ...common, resize: true, print: true })
  await setter.start()
  await frame()
  ElementSize.latest.emit(blocks()[0]!, 300)
  ElementSize.latest.emit(blocks()[0]!, 350)
  dispatchEvent(new Event("beforeprint"))
  await vi.advanceTimersByTimeAsync(200)
  expect(engine.refresh).not.toHaveBeenCalled()
  expect(engine.typeset).toHaveBeenCalledOnce()
  dispatchEvent(new Event("afterprint"))
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(2)
  setter.dispose()
})

test.each([true, "legacy"] as const)("resize observations use %j box metrics independently of the rectangle", async (boxes) => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  await frame()
  ElementSize.latest.emit(blocks()[0]!, 300, boxes)
  ElementSize.latest.emit(blocks()[0]!, 350, boxes, boxes === true ? 300 : 350)
  expect(engine.restore).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(150)
  expect(engine.refresh).toHaveBeenCalledOnce()
  setter.dispose()
})

test("empty or print-paused queues do not schedule animation work", async () => {
  const setter = createTypesetter({ ...common, print: true })
  await setter.start()
  await frame()
  const schedule = vi.spyOn(globalThis, "requestAnimationFrame")
  setter.rescan()
  expect(schedule).not.toHaveBeenCalled()
  dispatchEvent(new Event("beforeprint"))
  setter.refresh()
  expect(setter.stats().queued).toBe(3)
  expect(schedule).not.toHaveBeenCalled()
  setter.dispose()
})
