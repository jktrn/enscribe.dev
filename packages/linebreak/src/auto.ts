/**
 * `@enscribe/linebreak/auto` — progressive enhancement with a lifetime.
 *
 * Owns everything you would otherwise write yourself: discovery, waiting for
 * fonts, viewport laziness, frame-budgeted batching, reflow on resize, the
 * guard against elements whose width depends on their own content, print, and
 * clipboard repair.
 *
 * ```ts
 * import { createTypesetter } from "@enscribe/linebreak/auto"
 * import "@enscribe/linebreak/styles.css"
 *
 * createTypesetter().start()
 * ```
 */

import { handleCopy } from "./dom/clipboard"
import { proseBlocks } from "./dom/discover"
import { createLinebreaker } from "./linebreaker"
import type {
  Linebreaker,
  LinebreakerOptions,
  LinebreakerStats,
  Outcome,
} from "./types"

export type TypesetterOptions<Token = void> = LinebreakerOptions & {
  /** Where to look. Default `"[data-linebreak-root]"`, else `<body>`. */
  roots?: string | Iterable<Element>
  /** Extra selector for content to leave ragged, on top of the defaults. */
  skip?: string
  /** Final say per candidate paragraph. */
  filter?: (element: HTMLElement) => boolean
  /** Replace discovery entirely. */
  blocks?: (root: Element) => Iterable<HTMLElement>

  /** Typeset only what is near the viewport. Default on, 200% lookahead. */
  lazy?: boolean | { margin?: string }
  /** Per-frame work budget. */
  budget?: { blocksPerSlice?: number; sliceMs?: number }

  /** Wait for fonts, and re-measure when more arrive. Default true. */
  fonts?: boolean
  /** Reflow when a paragraph's width changes. Default true. */
  resize?: boolean
  /** Restore authored content while printing. Default true. */
  print?: boolean
  /** Register the `copy` handler on `document`. Default true. */
  copy?: boolean

  /** Runs immediately before any DOM-mutating phase, including restore. */
  beforeWrite?: () => Token
  /** Runs immediately after, with whatever `beforeWrite` returned. */
  afterWrite?: (token: Token) => void

  signal?: AbortSignal
}

export type TypesetterStats = LinebreakerStats & {
  readonly discovered: number
  readonly queued: number
  readonly slices: number
  readonly running: boolean
}

export interface Typesetter {
  /**
   * Resolves when the queue is empty and no reflow is pending. Re-arms
   * whenever new work appears, so read it fresh each time.
   */
  readonly settled: Promise<void>

  /** Wait for fonts, discover blocks, start observing. Idempotent. */
  start(): Promise<void>
  /** Restore everything and stop observing. Measurements are kept. */
  stop(): void

  /** Width or typography changed: restore and re-queue, keeping measurements. */
  refresh(): void
  /** Content changed: re-run discovery. */
  rescan(): void

  /** Typeset now, synchronously, ignoring laziness and the frame budget. */
  typeset(elements?: Iterable<HTMLElement>): readonly Outcome[]

  stats(): TypesetterStats

  dispose(): void
}

const DEFAULT_ROOTS = "[data-linebreak-root]"
const DEFAULT_MARGIN = "200% 0px"
const DEFAULT_BLOCKS_PER_SLICE = 12
const DEFAULT_SLICE_MS = 6
const RESIZE_SETTLE_MS = 150
const WIDTH_EPSILON = 0.5

/** Why work is currently held. A boolean cannot express overlapping holds. */
type PauseReason = "resize" | "print" | "stopped"

class BrowserTypesetter<Token> implements Typesetter {
  private readonly linebreaker: Linebreaker
  private readonly options: TypesetterOptions<Token>
  private readonly blocksPerSlice: number
  private readonly sliceMs: number

  private readonly queued = new Set<HTMLElement>()
  private readonly known = new Set<HTMLElement>()
  /** Blocks currently near the viewport, so a reflow re-does only those. */
  private readonly visible = new Set<HTMLElement>()
  private readonly paused = new Set<PauseReason>(["stopped"])
  private readonly widths = new WeakMap<Element, number>()

  private viewport: IntersectionObserver | undefined
  private measure: ResizeObserver | undefined
  private frame = 0
  private settleTimer: ReturnType<typeof setTimeout> | undefined
  private sliceCount = 0
  private generation = 0
  private disposed = false

  private settledPromise = Promise.resolve()
  private resolveSettled: (() => void) | undefined

  constructor(options: TypesetterOptions<Token>) {
    this.options = options
    this.linebreaker = createLinebreaker(options)
    this.blocksPerSlice =
      options.budget?.blocksPerSlice ?? DEFAULT_BLOCKS_PER_SLICE
    this.sliceMs = options.budget?.sliceMs ?? DEFAULT_SLICE_MS

    if (options.copy !== false) {
      document.addEventListener("copy", handleCopy, { signal: options.signal })
    }
    if (options.print !== false) {
      addEventListener("beforeprint", this.onBeforePrint, {
        signal: options.signal,
      })
      addEventListener("afterprint", this.onAfterPrint, {
        signal: options.signal,
      })
    }
    options.signal?.addEventListener("abort", () => this.dispose(), {
      once: true,
    })
  }

  get settled() {
    return this.settledPromise
  }

  async start() {
    if (this.disposed) throw new TypeError("linebreak: typesetter disposed")
    if (!this.paused.has("stopped")) return
    const generation = ++this.generation

    if (this.options.fonts !== false && document.fonts) {
      await document.fonts.ready
      if (generation !== this.generation || this.disposed) return
      // Faces that arrive later invalidate measurements taken before them.
      document.fonts.addEventListener("loadingdone", this.onFontsChanged, {
        signal: this.options.signal,
      })
    }

    this.paused.delete("stopped")
    this.rescan()
    this.observeResize()
  }

  stop() {
    this.paused.add("stopped")
    this.generation += 1
    clearTimeout(this.settleTimer)
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
    this.viewport?.disconnect()
    this.viewport = undefined
    this.measure?.disconnect()
    this.measure = undefined
    this.restoreAll()
    this.queued.clear()
    this.known.clear()
    this.visible.clear()
    this.markSettled()
  }

  refresh() {
    if (this.paused.has("stopped")) return
    this.restoreAll()
    this.linebreaker.refresh()
    this.requeue()
    this.schedule()
  }

  /**
   * Re-queue what a reflow should redo. With laziness on that is only what is
   * near the viewport; the rest re-queues itself when it scrolls back in.
   */
  private requeue() {
    const targets = this.lazy ? this.visible : this.known
    for (const block of targets) {
      if (block.isConnected) this.queued.add(block)
    }
  }

  rescan() {
    if (this.paused.has("stopped")) return
    for (const block of this.discover()) {
      if (this.known.has(block)) continue
      this.known.add(block)
      if (this.lazy) this.viewportObserver().observe(block)
      else this.queued.add(block)
      this.resizeObserver()?.observe(block)
    }
    for (const block of this.known) {
      if (block.isConnected) continue
      this.known.delete(block)
      this.queued.delete(block)
      this.visible.delete(block)
    }
    this.schedule()
  }

  typeset(elements?: Iterable<HTMLElement>): readonly Outcome[] {
    const targets = elements ? [...elements] : [...this.queued]
    if (targets.length === 0) return []
    for (const element of targets) this.queued.delete(element)
    return this.write(targets)
  }

  stats(): TypesetterStats {
    return {
      ...this.linebreaker.stats(),
      discovered: this.known.size,
      queued: this.queued.size,
      slices: this.sliceCount,
      running: !this.paused.has("stopped"),
    }
  }

  dispose() {
    if (this.disposed) return
    this.stop()
    this.linebreaker.dispose()
    if (this.options.copy !== false) {
      document.removeEventListener("copy", handleCopy)
    }
    removeEventListener("beforeprint", this.onBeforePrint)
    removeEventListener("afterprint", this.onAfterPrint)
    document.fonts?.removeEventListener("loadingdone", this.onFontsChanged)
    this.disposed = true
  }

  // ── internals ────────────────────────────────────────────────────────────

  private get lazy() {
    return this.options.lazy !== false
  }

  private discover(): HTMLElement[] {
    const { roots, blocks, skip, filter } = this.options
    const targets: Element[] =
      typeof roots === "string" || roots === undefined
        ? [...document.querySelectorAll(roots ?? DEFAULT_ROOTS)]
        : [...roots]
    if (targets.length === 0 && (roots === undefined || roots === DEFAULT_ROOTS)) {
      targets.push(document.body)
    }
    const out: HTMLElement[] = []
    for (const root of targets) {
      out.push(...(blocks ? blocks(root) : proseBlocks(root, { skip, filter })))
    }
    return out
  }

  private viewportObserver() {
    this.viewport ??= new IntersectionObserver(
      (entries) => {
        if (this.paused.has("stopped")) return
        for (const entry of entries) {
          const block = entry.target as HTMLElement
          // Deliberately not unobserved: staying subscribed is what lets a
          // reflow re-do only what is on screen, so the cost of a resize does
          // not grow with how far the reader has scrolled.
          if (entry.isIntersecting) {
            this.visible.add(block)
            this.queued.add(block)
          } else {
            this.visible.delete(block)
          }
        }
        this.schedule()
      },
      {
        rootMargin:
          (typeof this.options.lazy === "object"
            ? this.options.lazy.margin
            : undefined) ?? DEFAULT_MARGIN,
      },
    )
    return this.viewport
  }

  private resizeObserver() {
    if (this.options.resize === false) return undefined
    this.measure ??= new ResizeObserver((entries) => {
      if (this.paused.has("stopped")) return
      let moved = false
      for (const entry of entries) {
        const width =
          entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
        const previous = this.widths.get(entry.target)
        this.widths.set(entry.target, width)
        if (previous === undefined) continue
        if (Math.abs(previous - width) > WIDTH_EPSILON) moved = true
      }
      if (!moved) return

      this.paused.add("resize")
      this.restoreAll()
      clearTimeout(this.settleTimer)
      this.settleTimer = setTimeout(() => {
        this.settleTimer = undefined
        this.paused.delete("resize")
        this.linebreaker.refresh()
        this.requeue()
        this.schedule()
      }, RESIZE_SETTLE_MS)
    })
    return this.measure
  }

  private observeResize() {
    const observer = this.resizeObserver()
    if (!observer) return
    for (const block of this.known) observer.observe(block)
  }

  private schedule() {
    if (this.paused.size > 0 || this.frame || this.queued.size === 0) return
    this.arm()
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.flush()
    })
  }

  private flush() {
    if (this.paused.size > 0) return
    const started = performance.now()
    const slice: HTMLElement[] = []

    for (const block of this.queued) {
      // Budget is checked before taking work, so a slice cannot overshoot.
      if (
        slice.length >= this.blocksPerSlice ||
        (slice.length > 0 && performance.now() - started >= this.sliceMs)
      ) {
        break
      }
      this.queued.delete(block)
      slice.push(block)
    }

    if (slice.length > 0) {
      this.sliceCount += 1
      try {
        this.write(slice)
      } catch (cause) {
        // One bad paragraph must not stop the pipeline for the whole page.
        this.options.onOutcome?.({
          element: slice[0] as HTMLElement,
          status: "failed",
          reason: "render-failed",
          cause,
        })
      }
    }

    if (this.queued.size > 0) this.schedule()
    else this.markSettled()
  }

  private write(elements: readonly HTMLElement[]): readonly Outcome[] {
    const token = this.options.beforeWrite?.() as Token
    try {
      return this.linebreaker.typeset(elements)
    } finally {
      this.options.afterWrite?.(token)
    }
  }

  private restoreAll() {
    const token = this.options.beforeWrite?.() as Token
    try {
      // Drive this off what was discovered rather than off the engine's own
      // notion of which elements are live. A block holding lines solved for a
      // stale measure must be put back even if that bookkeeping has drifted;
      // restoring an element that is not typeset is a no-op.
      this.linebreaker.restore(this.known)
    } finally {
      this.options.afterWrite?.(token)
    }
  }

  private arm() {
    if (this.resolveSettled) return
    this.settledPromise = new Promise((resolve) => {
      this.resolveSettled = resolve
    })
  }

  private markSettled() {
    this.resolveSettled?.()
    this.resolveSettled = undefined
    this.settledPromise = Promise.resolve()
  }

  private readonly onBeforePrint = () => {
    this.paused.add("print")
    // Clearing the settle timer matters: otherwise a resize moments before
    // ⌘P un-pauses mid-job and typesets at the print measure.
    clearTimeout(this.settleTimer)
    this.settleTimer = undefined
    this.paused.delete("resize")
    this.restoreAll()
  }

  private readonly onAfterPrint = () => {
    this.paused.delete("print")
    this.requeue()
    this.schedule()
  }

  private readonly onFontsChanged = () => {
    if (this.paused.has("stopped")) return
    const token = this.options.beforeWrite?.() as Token
    try {
      // Widths measured against the previous faces are now wrong, so drop the
      // measurements outright. Restoring first would empty the live set and
      // leave `reset()` nothing to find, and the stale metrics would then be
      // reused the next time these blocks are composed.
      this.linebreaker.reset(this.known)
    } finally {
      this.options.afterWrite?.(token)
    }
    this.requeue()
    this.schedule()
  }
}

export const createTypesetter = <Token = void>(
  options: TypesetterOptions<Token> = {},
): Typesetter => new BrowserTypesetter(options)

export { proseBlocks, DEFAULT_SKIP } from "./dom/discover"
export type { DiscoverOptions } from "./dom/discover"
export type {
  Composition,
  DeclineReason,
  FailureReason,
  Linebreaker,
  LinebreakerOptions,
  LinebreakerStats,
  Outcome,
  SkipReason,
} from "./types"
