import { vi } from "vitest"
import * as engineModule from "@linebreak/linebreaker"
import {
  COMPOSITION_BRAND,
  type Composition,
  type Linebreaker,
  type Outcome,
} from "@linebreak/types"
import { ElementSize, Viewport } from "./observers"

const fakeEngine = () => {
  const typeset = vi.fn((elements: Iterable<HTMLElement>): Outcome[] =>
    [...elements].map((element) => ({
      element,
      status: "typeset",
      lines: 2,
      retries: 0,
    })),
  )
  return {
    warm: vi.fn(),
    compose: vi.fn((elements: Iterable<HTMLElement>): Composition[] =>
      [...elements].map((element) => ({
        brand: COMPOSITION_BRAND,
        element,
        status: "ready",
        lines: 2,
        width: 300,
      })),
    ),
    apply: vi.fn((compositions: Iterable<Composition>) =>
      typeset([...compositions].map((composition) => composition.element)),
    ),
    typeset,
    restore: vi.fn(),
    reset: vi.fn(),
    fontsMoved: vi.fn(() => false),
    refresh: vi.fn(),
    stats: vi.fn(() => ({
      typeset: 0,
      skipped: 0,
      declined: 0,
      failed: 0,
      retries: 0,
      liveElements: 0,
      cachedFonts: 0,
    })),
    dispose: vi.fn(),
  } satisfies Linebreaker
}
export let engine: ReturnType<typeof fakeEngine>
export let fontEvents: EventTarget
export const blocks = () => [...document.querySelectorAll("p")]
export const common = {
  fonts: false,
  copy: false,
  print: false,
  resize: false,
  lazy: false,
  blocks,
}
export const frame = async () => {
  await vi.advanceTimersByTimeAsync(17)
}

export const autoFixture = () => {
  document.body.innerHTML =
    "<article><p>One paragraph</p><p>Two paragraphs</p><p>Three paragraphs</p></article>"
  engine = fakeEngine()
  vi.spyOn(engineModule, "createLinebreaker").mockReturnValue(engine)
  vi.useFakeTimers()
  vi.stubGlobal("IntersectionObserver", Viewport)
  vi.stubGlobal("ResizeObserver", ElementSize)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  )
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id))
  fontEvents = Object.assign(new EventTarget(), { ready: Promise.resolve() })
  Object.defineProperty(document, "fonts", {
    value: fontEvents,
    configurable: true,
  })
}
export const restoreAutoFixture = () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
}
