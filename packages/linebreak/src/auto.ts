import { queuedSlice, captureBatch } from "./browser/scheduling"
import { ATTRIBUTES } from "./attributes"
import { handleCopy } from "./dom/clipboard"
import { proseBlocks } from "./dom/discover"
import { createLinebreaker } from "./linebreaker"
import { engineDefaults } from "./policy"
import type {
  Linebreaker,
  LinebreakerOptions,
  LinebreakerStats,
  Outcome,
} from "./types"

export type TypesetterOptions<Token = void> = LinebreakerOptions & {
  roots?: string | Iterable<Element>
  skip?: string
  filter?: (element: HTMLElement) => boolean
  blocks?: (root: Element) => Iterable<HTMLElement>

  lazy?: boolean | { margin?: string }
  budget?: { blocksPerSlice?: number; sliceMs?: number }

  fonts?: boolean
  resize?: boolean
  print?: boolean
  copy?: boolean

  beforeWrite?: () => Token
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
  readonly settled: Promise<void>

  start(): Promise<void>
  stop(): void

  refresh(): void
  rescan(): void

  typeset(elements?: Iterable<HTMLElement>): readonly Outcome[]

  stats(): TypesetterStats

  dispose(): void
}

const DEFAULT_ROOTS = `[${ATTRIBUTES.root}]`
const DEFAULT_MARGIN = "200% 0px"
const DEFAULT_BLOCKS_PER_SLICE = 12
const DEFAULT_SLICE_MS = 6
const RESIZE_SETTLE_MS = 150

type PauseReason = "resize" | "print" | "stopped"

class BrowserTypesetter<Token> implements Typesetter {
  private readonly linebreaker: Linebreaker
  private readonly options: TypesetterOptions<Token>
  private readonly blocksPerSlice: number
  private readonly sliceMs: number

  private readonly queued = new Set<HTMLElement>()
  private readonly known = new Set<HTMLElement>()
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
  private writing = false
  private readonly lifecycle = new AbortController()

  private settledPromise = Promise.resolve()
  private resolveSettled: (() => void) | undefined

  constructor(options: TypesetterOptions<Token>) {
    this.options = options
    this.linebreaker = createLinebreaker({
      ...options,
      onOutcome: undefined,
    })
    this.blocksPerSlice =
      options.budget?.blocksPerSlice ?? DEFAULT_BLOCKS_PER_SLICE
    this.sliceMs = options.budget?.sliceMs ?? DEFAULT_SLICE_MS

    if (!Number.isInteger(this.blocksPerSlice) || this.blocksPerSlice <= 0) {
      throw new RangeError(
        "linebreak: blocksPerSlice must be a positive integer",
      )
    }
    if (!Number.isFinite(this.sliceMs) || this.sliceMs <= 0) {
      throw new RangeError(
        "linebreak: sliceMs must be a finite positive number",
      )
    }

    if (options.copy !== false) {
      document.addEventListener("copy", this.onCopy, {
        signal: this.lifecycle.signal,
      })
    }
    if (options.print !== false) {
      addEventListener("beforeprint", this.onBeforePrint, {
        signal: this.lifecycle.signal,
      })
      addEventListener("afterprint", this.onAfterPrint, {
        signal: this.lifecycle.signal,
      })
    }
    options.signal?.addEventListener("abort", this.onAbort)
    if (options.signal?.aborted) this.dispose()
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
      document.fonts.addEventListener("loadingdone", this.onFontsChanged, {
        signal: this.lifecycle.signal,
      })
    }

    const token = this.options.beforeWrite?.() as Token
    try {
      this.linebreaker.warm(document)
    } finally {
      this.options.afterWrite?.(token)
    }

    this.paused.delete("stopped")
    this.rescan()
  }

  stop() {
    this.paused.add("stopped")
    this.generation += 1
    clearTimeout(this.settleTimer)
    this.settleTimer = undefined
    this.paused.delete("resize")
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.viewport?.disconnect()
    this.viewport = undefined
    this.measure?.disconnect()
    this.measure = undefined
    try {
      this.restoreAll()
    } finally {
      this.queued.clear()
      this.known.clear()
      this.visible.clear()
      this.markSettled()
    }
  }

  refresh() {
    if (this.paused.has("stopped")) return
    this.restoreAll()
    this.linebreaker.refresh()
    this.requeue()
    this.schedule()
  }

  private requeue() {
    const targets = this.lazy ? this.visible : this.known
    for (const block of targets) {
      if (block.isConnected) this.queued.add(block)
    }
  }

  private track(block: HTMLElement) {
    if (this.known.has(block)) return
    this.known.add(block)
    if (this.lazy) this.viewportObserver().observe(block)
    else this.queued.add(block)
    this.resizeObserver()?.observe(block)
  }

  private forgetDetached() {
    for (const block of this.known) {
      if (block.isConnected) continue
      this.known.delete(block)
      this.queued.delete(block)
      this.visible.delete(block)
      this.viewport?.unobserve(block)
      this.measure?.unobserve(block)
    }
  }

  rescan() {
    if (this.paused.has("stopped")) return
    for (const block of this.discover()) this.track(block)
    this.forgetDetached()
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
    this.disposed = true
    this.lifecycle.abort()
    this.options.signal?.removeEventListener("abort", this.onAbort)
    try {
      this.stop()
    } finally {
      this.linebreaker.dispose()
    }
  }

  private get lazy() {
    return this.options.lazy !== false
  }

  private rootsFor(): Element[] {
    const { roots } = this.options
    if (typeof roots !== "string" && roots !== undefined) return [...roots]

    const targets: Element[] = [
      ...document.querySelectorAll(roots ?? DEFAULT_ROOTS),
    ]
    if (
      targets.length === 0 &&
      (roots === undefined || roots === DEFAULT_ROOTS)
    ) {
      targets.push(document.body)
    }
    return targets
  }

  private discover(): HTMLElement[] {
    const { blocks, skip, filter } = this.options
    const out: HTMLElement[] = []
    for (const root of this.rootsFor()) {
      out.push(...(blocks ? blocks(root) : proseBlocks(root, { skip, filter })))
    }
    return out
  }

  private onIntersect(entries: readonly IntersectionObserverEntry[]) {
    if (this.paused.has("stopped")) return
    for (const entry of entries) {
      const block = entry.target as HTMLElement
      if (entry.isIntersecting) {
        this.visible.add(block)
        this.queued.add(block)
      } else {
        this.visible.delete(block)
      }
    }
    this.schedule()
  }

  private lazyMargin() {
    const { lazy } = this.options
    return (
      (typeof lazy === "object" ? lazy.margin : undefined) ?? DEFAULT_MARGIN
    )
  }

  private viewportObserver() {
    this.viewport ??= new IntersectionObserver(
      (entries) => this.onIntersect(entries),
      { rootMargin: this.lazyMargin() },
    )
    return this.viewport
  }

  private widthsMoved(entries: readonly ResizeObserverEntry[]) {
    let moved = false
    for (const entry of entries) {
      const width =
        entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
      const previous = this.widths.get(entry.target) ?? width
      this.widths.set(entry.target, width)
      if (Math.abs(previous - width) > engineDefaults.widthEpsilon) moved = true
    }
    return moved
  }

  private afterResize() {
    this.settleTimer = undefined
    this.paused.delete("resize")
    this.linebreaker.refresh()
    this.requeue()
    this.schedule()
  }

  private onResize(entries: readonly ResizeObserverEntry[]) {
    if (this.paused.has("stopped")) return
    if (!this.widthsMoved(entries)) return

    this.paused.add("resize")
    this.restoreAll()
    clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(() => this.afterResize(), RESIZE_SETTLE_MS)
  }

  private resizeObserver() {
    if (this.options.resize === false) return undefined
    this.measure ??= new ResizeObserver((entries) => this.onResize(entries))
    return this.measure
  }

  private schedule() {
    if (this.paused.size > 0 || this.frame || this.queued.size === 0) return
    this.arm()
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.flush()
    })
  }

  private writeSlice() {
    this.sliceCount += 1
    this.write(
      queuedSlice(this.queued, this.blocksPerSlice, this.sliceMs),
      true,
    )
  }

  private flush() {
    if (this.paused.size > 0) return

    try {
      if (this.queued.size > 0) this.writeSlice()
    } finally {
      if (this.queued.size > 0) this.schedule()
      else this.markSettled()
    }
  }

  private write(
    elements: Iterable<HTMLElement>,
    recover = false,
  ): readonly Outcome[] {
    if (this.writing)
      throw new TypeError("linebreak: automatic typesetting re-entered")
    const batch = captureBatch(elements)
    this.writing = true
    try {
      let outcomes: readonly Outcome[]
      try {
        outcomes = this.layout(batch.elements)
      } catch (cause) {
        if (!recover) throw cause
        outcomes = [
          {
            element: batch.first,
            status: "failed",
            reason: "render-failed",
            cause:
              cause instanceof Error
                ? cause
                : new Error("Automatic layout threw a non-Error value"),
          },
        ]
      }
      // User callbacks run outside recovery: each outcome is delivered once.
      for (const outcome of outcomes) this.options.onOutcome?.(outcome)
      return outcomes
    } finally {
      this.writing = false
    }
  }

  private layout(elements: Iterable<HTMLElement>): readonly Outcome[] {
    const token = this.options.beforeWrite?.() as Token
    try {
      return this.linebreaker.apply(this.linebreaker.compose(elements))
    } finally {
      this.options.afterWrite?.(token)
    }
  }

  private restoreAll() {
    const token = this.options.beforeWrite?.() as Token
    try {
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
    if (!this.linebreaker.fontsMoved(document)) return
    const token = this.options.beforeWrite?.() as Token
    try {
      this.linebreaker.reset(this.known)
    } finally {
      this.options.afterWrite?.(token)
    }
    this.requeue()
    this.schedule()
  }

  private readonly onAbort = () => this.dispose()
  private readonly onCopy = (event: ClipboardEvent) => {
    if (!event.defaultPrevented) handleCopy(event)
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
  Hyphenator,
  Linebreaker,
  LinebreakerOptions,
  LinebreakerStats,
  Outcome,
  SkipReason,
} from "./types"
