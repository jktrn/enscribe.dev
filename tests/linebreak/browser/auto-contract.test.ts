import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { createTypesetter } from "@linebreak/auto"
import * as clipboard from "@linebreak/dom/clipboard"
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

test("only the latest startup proceeds after stop and restart while fonts load", async () => {
  let ready: () => void = () => {}
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      ready: new Promise<void>((resolve) => {
        ready = resolve
      }),
    }),
  })
  const setter = createTypesetter({ ...common, fonts: true })
  const obsolete = setter.start()
  setter.stop()
  const current = setter.start()
  ready()
  await Promise.all([obsolete, current])
  expect(engine.warm).toHaveBeenCalledOnce()
  await frame()
  expect(engine.typeset).toHaveBeenCalledOnce()
  setter.dispose()
})

test.each([
  false,
  true,
  undefined,
])("copy option %j controls clipboard interception and teardown", (copy) => {
  const handle = vi.spyOn(clipboard, "handleCopy").mockImplementation(() => {})
  const setter = createTypesetter({ ...common, copy })
  document.dispatchEvent(new Event("copy"))
  expect(handle).toHaveBeenCalledTimes(copy === false ? 0 : 1)
  setter.dispose()
  document.dispatchEvent(new Event("copy"))
  expect(handle).toHaveBeenCalledTimes(copy === false ? 0 : 1)
})

test.each([
  false,
  true,
  undefined,
])("print option %j controls restoration and cleanup", async (print) => {
  const setter = createTypesetter({ ...common, print })
  await setter.start()
  engine.restore.mockClear()
  dispatchEvent(new Event("beforeprint"))
  expect(engine.restore).toHaveBeenCalledTimes(print === false ? 0 : 1)
  dispatchEvent(new Event("afterprint"))
  setter.dispose()
  engine.restore.mockClear()
  dispatchEvent(new Event("beforeprint"))
  dispatchEvent(new Event("afterprint"))
  expect(engine.restore).not.toHaveBeenCalled()
  expect(setter.stats().queued).toBe(0)
})

test("abort removes clipboard, font, and print listeners", async () => {
  const abort = new AbortController()
  const handle = vi.spyOn(clipboard, "handleCopy").mockImplementation(() => {})
  const setter = createTypesetter({
    ...common,
    copy: true,
    print: true,
    fonts: true,
    signal: abort.signal,
  })
  await setter.start()
  abort.abort()
  engine.restore.mockClear()
  document.dispatchEvent(new Event("copy"))
  dispatchEvent(new Event("beforeprint"))
  fontEvents.dispatchEvent(new Event("loadingdone"))
  expect(handle).not.toHaveBeenCalled()
  expect(engine.restore).not.toHaveBeenCalled()
  expect(engine.fontsMoved).not.toHaveBeenCalled()
})

test("explicit disposal releases the external abort listener", () => {
  const abort = new AbortController()
  const remove = vi.spyOn(abort.signal, "removeEventListener")
  const setter = createTypesetter({ ...common, signal: abort.signal })
  setter.dispose()
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function))
})

test("stopping cancels pending frame and resize timer work", async () => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  ElementSize.latest.emit(blocks()[0]!, 300)
  ElementSize.latest.emit(blocks()[0]!, 400)
  expect(vi.getTimerCount()).toBeGreaterThan(0)
  setter.stop()
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(200)
  expect(engine.refresh).not.toHaveBeenCalled()
  expect(engine.typeset).not.toHaveBeenCalled()
  setter.dispose()
})

test("a repeated scan does not requeue existing eagerly rendered paragraphs", async () => {
  const setter = createTypesetter(common)
  await setter.start()
  await frame()
  setter.rescan()
  await frame()
  expect(engine.typeset).toHaveBeenCalledOnce()
  setter.dispose()
})

test("detached visible paragraphs are removed from both discovery and work queues", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  const p = blocks()[0]!
  Viewport.latest.emit(p, true)
  expect(setter.stats().queued).toBe(1)
  p.remove()
  setter.rescan()
  expect(setter.stats().queued).toBe(0)
  // A reattached node is not visible until observed again.
  document.body.append(p)
  setter.refresh()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("stop and dispose complete cleanup even when restoration hooks throw", async () => {
  const before = vi.fn()
  const setter = createTypesetter({
    ...common,
    beforeWrite: before,
    print: true,
  })
  await setter.start()
  const settled = vi.fn()
  void setter.settled.then(settled)
  before.mockImplementation(() => {
    throw new Error("hook failed")
  })
  expect(() => setter.dispose()).toThrow("hook failed")
  await Promise.resolve()
  expect(settled).toHaveBeenCalledOnce()
  expect(engine.dispose).toHaveBeenCalledOnce()
  expect(setter.stats()).toMatchObject({
    running: false,
    queued: 0,
    discovered: 0,
  })
  expect(() => dispatchEvent(new Event("beforeprint"))).not.toThrow()
  await expect(setter.start()).rejects.toThrow("disposed")
})

test("fonts-disabled startup does not touch the font loading API", async () => {
  const ready = vi.fn(() => Promise.resolve())
  const fonts = new EventTarget()
  Object.defineProperty(fonts, "ready", { get: ready })
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  })
  ready.mockClear()
  const setter = createTypesetter(common)
  await setter.start()
  expect(ready).not.toHaveBeenCalled()
  setter.dispose()
})

test("a failed slice with no callback keeps the queue moving", async () => {
  const setter = createTypesetter({ ...common, budget: { blocksPerSlice: 1 } })
  engine.typeset.mockImplementationOnce(() => {
    throw new Error("layout failed")
  })
  await setter.start()
  await frame()
  await frame()
  await frame()
  expect(engine.typeset).toHaveBeenCalledTimes(3)
  await setter.settled
  setter.dispose()
})

test("root selection respects the configured selector without falling back to body", async () => {
  document.body.innerHTML =
    "<section data-linebreak-root><p>inside</p></section><p>outside</p>"
  const discover = (root: Element) => [...root.querySelectorAll("p")]
  const setter = createTypesetter({ ...common, blocks: discover })
  await setter.start()
  expect(setter.stats().discovered).toBe(1)
  setter.dispose()
  const explicit = createTypesetter({
    ...common,
    roots: "section",
    blocks: discover,
  })
  await explicit.start()
  expect(explicit.stats().discovered).toBe(1)
  explicit.dispose()
})

test("default root fallback also applies to an explicitly supplied default selector", async () => {
  const setter = createTypesetter({
    ...common,
    roots: "[data-linebreak-root]",
    blocks: (root) => [...root.querySelectorAll("p")],
  })
  await setter.start()
  expect(setter.stats().discovered).toBe(3)
  setter.dispose()
})

test("manual refresh restores before remeasurement while the setter is running", async () => {
  const setter = createTypesetter(common)
  await setter.start()
  await frame()
  engine.restore.mockClear()
  setter.refresh()
  expect(engine.restore).toHaveBeenCalledOnce()
  expect(engine.restore.mock.invocationCallOrder[0]).toBeLessThan(
    engine.refresh.mock.invocationCallOrder[0]!,
  )
  setter.dispose()
})

test("leaving the viewport removes a paragraph from later lazy refreshes", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  const p = blocks()[0]!
  Viewport.latest.emit(p, true)
  await frame()
  Viewport.latest.emit(p, false)
  setter.refresh()
  expect(setter.stats().queued).toBe(0)
  setter.dispose()
})

test("an initial size notification and exactly half a pixel of drift do not start resize work", async () => {
  const setter = createTypesetter({ ...common, resize: true })
  await setter.start()
  await frame()
  const p = blocks()[0]!
  ElementSize.latest.emit(p, 300)
  expect(engine.restore).not.toHaveBeenCalled()
  ElementSize.latest.emit(p, 300.5)
  expect(engine.restore).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
  ElementSize.latest.emit(p, 301.01)
  expect(engine.restore).toHaveBeenCalledOnce()
  setter.dispose()
})

test("repeated scheduling before the next frame only creates one frame", async () => {
  const setter = createTypesetter({ ...common, lazy: true })
  await setter.start()
  for (const p of blocks()) Viewport.latest.emit(p, true)
  expect(vi.getTimerCount()).toBe(1)
  await frame()
  expect(engine.typeset).toHaveBeenCalledOnce()
  setter.dispose()
})

test("manual typesetting balances write hooks even when rendering throws", () => {
  const before = vi.fn(() => "selection"),
    after = vi.fn()
  const setter = createTypesetter({
    ...common,
    beforeWrite: before,
    afterWrite: after,
  })
  engine.typeset.mockImplementation(() => {
    throw new Error("render failed")
  })
  expect(() => setter.typeset([blocks()[0]!])).toThrow("render failed")
  expect(before).toHaveBeenCalledOnce()
  expect(after).toHaveBeenCalledWith("selection")
  setter.dispose()
})

test("font invalidation balances write hooks and requeues visible content", async () => {
  const before = vi.fn(() => "selection"),
    after = vi.fn()
  const setter = createTypesetter({
    ...common,
    fonts: true,
    beforeWrite: before,
    afterWrite: after,
  })
  await setter.start()
  await frame()
  before.mockClear()
  after.mockClear()
  engine.fontsMoved.mockReturnValue(true)
  fontEvents.dispatchEvent(new Event("loadingdone"))
  expect(before).toHaveBeenCalledOnce()
  expect(after).toHaveBeenCalledWith("selection")
  expect(setter.stats().queued).toBe(3)
  setter.dispose()
})

test("manual outcome callbacks cannot re-enter typesetting", () => {
  const setter = createTypesetter({
    ...common,
    onOutcome: () => {
      expect(() => setter.typeset([blocks()[0]!])).toThrow("re-entered")
    },
  })
  expect(setter.typeset([blocks()[0]!])).toHaveLength(1)
  setter.dispose()
})

test("callback failures preserve the original thrown value without duplicate reports", () => {
  const cause = new Error("application callback")
  const report = vi.fn(() => {
    throw cause
  })
  const setter = createTypesetter({ ...common, onOutcome: report })
  expect(() => setter.typeset([blocks()[0]!])).toThrow(cause)
  expect(report).toHaveBeenCalledOnce()
  setter.dispose()
})

test("disposing one typesetter preserves clipboard handling owned by another", () => {
  const handle = vi
    .spyOn(clipboard, "handleCopy")
    .mockImplementation((event) => event.preventDefault())
  const first = createTypesetter({ ...common, copy: true })
  const second = createTypesetter({ ...common, copy: true })
  document.dispatchEvent(new Event("copy", { cancelable: true }))
  expect(handle).toHaveBeenCalledOnce()
  first.dispose()
  document.dispatchEvent(new Event("copy", { cancelable: true }))
  expect(handle).toHaveBeenCalledTimes(2)
  second.dispose()
})

test("clipboard handling respects an earlier application listener", () => {
  const handle = vi.spyOn(clipboard, "handleCopy").mockImplementation(() => {})
  const setter = createTypesetter({ ...common, copy: true })
  const event = new Event("copy", { cancelable: true })
  event.preventDefault()
  document.dispatchEvent(event)
  expect(handle).not.toHaveBeenCalled()
  setter.dispose()
})

test("startup still works when FontFaceSet is unavailable", async () => {
  Object.defineProperty(document, "fonts", {
    value: undefined,
    configurable: true,
  })
  const setter = createTypesetter({ ...common, fonts: true })
  await setter.start()
  await frame()
  expect(engine.warm).toHaveBeenCalledOnce()
  setter.dispose()
})
