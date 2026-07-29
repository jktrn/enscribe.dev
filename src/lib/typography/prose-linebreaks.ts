import {
  createLinebreaker,
  type Diagnostic,
  type LinebreakPlan,
} from "@enscribe/linebreak"
import {
  captureReadingAnchor,
  restoreReadingAnchor,
} from "@/lib/typography/scroll-anchor"

const NOT_PROSE = [
  "[data-typeset-skip]",
  "pre",
  ".expressive-code",
  "table",
  "math",
  "math-display",
  "svg",
  "h1, h2, h3, h4, h5, h6",
  "summary",
  "button, select, textarea",
  "script, style, template",
].join(", ")

const INLINE_LEVEL = new Set([
  "contents",
  "math",
  "none",
  "ruby",
  "ruby-base",
  "ruby-base-container",
  "ruby-text",
  "ruby-text-container",
])

const MINIMUM_WIDTH = 240
const LOOKAHEAD = "200% 0px"
const BLOCKS_PER_FLUSH = 12
const FLUSH_BUDGET_MS = 6
const IDLE_TIMEOUT_MS = 200
const RESIZE_SETTLE_MS = 150
const WIDTH_TOLERANCE = 0.5
const UNSTABLE_RESIZE_LIMIT = 4
const UNSTABLE_RESIZE_WINDOW_MS = 8000

type FlushDeadline = { timeRemaining: () => number }

const runWhenIdle = (flush: (deadline: FlushDeadline) => void) => {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(flush, { timeout: IDLE_TIMEOUT_MS })
    return
  }
  const start = performance.now()
  setTimeout(() =>
    flush({
      timeRemaining: () =>
        Math.max(0, FLUSH_BUDGET_MS - (performance.now() - start)),
    }),
  )
}

const reportDiagnostic = (diagnostic: Diagnostic) => {
  if (!import.meta.env.DEV) return
  console.warn(`linebreak: ${diagnostic.kind}`, diagnostic.element, diagnostic)
}

const isInlineLevel = (element: Element) => {
  const { display } = getComputedStyle(element)
  return display.startsWith("inline") || INLINE_LEVEL.has(display)
}

const collectBlocks = (element: Element, blocks: HTMLElement[]) => {
  if (element.matches(NOT_PROSE)) return

  const blockChildren: Element[] = []
  for (const child of element.children) {
    if (!isInlineLevel(child)) blockChildren.push(child)
  }
  if (blockChildren.length > 0) {
    for (const child of blockChildren) collectBlocks(child, blocks)
    return
  }
  if (element instanceof HTMLElement && (element.textContent ?? "").trim()) {
    blocks.push(element)
  }
}

export const proseBlocksIn = (container: Element) => {
  const blocks: HTMLElement[] = []
  collectBlocks(container, blocks)
  return blocks
}

export const typesetProse = (containers: readonly HTMLElement[]) => {
  const blocks = containers.flatMap((container) => proseBlocksIn(container))
  if (blocks.length === 0) return () => {}

  const linebreaker = createLinebreaker({
    locale: document.documentElement.lang || "en-US",
    minimumWidth: MINIMUM_WIDTH,
    hyphenate: true,
    preserveImageAttributes: ["data-loaded"],
    onDiagnostic: reportDiagnostic,
  })
  const queued = new Set<HTMLElement>()

  const seen = new Set<HTMLElement>()
  const typeset = new Set<HTMLElement>()
  const measures = new WeakMap<Element, number>()
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let flushScheduled = false
  let paused = false
  let stopped = false

  const schedule = () => {
    if (stopped || paused || flushScheduled || queued.size === 0) return
    flushScheduled = true
    runWhenIdle(flush)
  }

  const flush = (deadline: FlushDeadline) => {
    flushScheduled = false
    if (stopped || paused) return

    const plans: LinebreakPlan[] = []
    for (const block of queued) {
      queued.delete(block)
      seen.add(block)
      plans.push(linebreaker.plan(block))
      if (plans.length >= BLOCKS_PER_FLUSH || deadline.timeRemaining() <= 0) {
        break
      }
    }
    if (plans.length === 0) return

    const anchor = captureReadingAnchor()
    for (const result of linebreaker.commit(plans)) {
      if (result.state === "typeset") typeset.add(result.element)
    }
    restoreReadingAnchor(anchor)
    schedule()
  }

  const restoreTypeset = () => {
    if (seen.size === 0) return
    const anchor = captureReadingAnchor()
    linebreaker.restore(typeset)
    restoreReadingAnchor(anchor)
    for (const block of seen) queued.add(block)
    seen.clear()
    typeset.clear()
  }

  const viewport = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        viewport.unobserve(entry.target)
        queued.add(entry.target as HTMLElement)
      }
      schedule()
    },
    { rootMargin: LOOKAHEAD },
  )
  for (const block of blocks) viewport.observe(block)

  const resizeHistory = new WeakMap<Element, number[]>()
  const measure = new ResizeObserver((entries) => {
    if (stopped) return
    let resized = false
    for (const entry of entries) {
      const width = entry.contentRect.width
      const previous = measures.get(entry.target)
      measures.set(entry.target, width)

      if (previous === undefined) continue
      if (Math.abs(previous - width) <= WIDTH_TOLERANCE) continue

      const now = performance.now()
      const history = (resizeHistory.get(entry.target) ?? []).filter(
        (at) => now - at < UNSTABLE_RESIZE_WINDOW_MS,
      )
      history.push(now)
      resizeHistory.set(entry.target, history)
      if (history.length > UNSTABLE_RESIZE_LIMIT) {
        measure.unobserve(entry.target)
        if (import.meta.env.DEV) {
          console.warn(
            "linebreak: container width is unstable; leaving it as-is",
            entry.target,
          )
        }
        continue
      }
      resized = true
    }
    if (!resized) return

    paused = true
    restoreTypeset()
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      paused = false
      schedule()
    }, RESIZE_SETTLE_MS)
  })
  for (const container of containers) measure.observe(container)

  const suspend = () => {
    paused = true
    restoreTypeset()
  }
  const resume = () => {
    paused = false
    schedule()
  }
  addEventListener("beforeprint", suspend)
  addEventListener("afterprint", resume)

  return () => {
    stopped = true
    clearTimeout(settleTimer)
    viewport.disconnect()
    measure.disconnect()
    removeEventListener("beforeprint", suspend)
    removeEventListener("afterprint", resume)
    linebreaker.destroy()
  }
}
