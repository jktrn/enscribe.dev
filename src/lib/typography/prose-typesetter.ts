import {
  createLinebreaker,
  type Linebreaker,
  type LinebreakPlan,
} from "@enscribe/linebreak"
import {
  captureReadingAnchor,
  prioritizeForReading,
  restoreReadingAnchor,
} from "./scroll-anchor"
import { discoverTypesetContent, type TypesetContent } from "./typeset-content"

const layoutPolicy = {
  minimumWidth: 240,
  resizeTolerance: 0.75,
} as const

const schedulingPolicy = {
  frameBudget: 10,
  frameBackstop: 100,
  maximumStabilizationPasses: 2,
} as const

const readSelectedRange = () => {
  const selection = getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }
  return selection.getRangeAt(0)
}

const benchmarkEnabled = () =>
  new URLSearchParams(location.search).has("kp-benchmark")

type TypesettingRun = {
  blocks: HTMLElement[]
  index: number
  retryCounts: Map<HTMLElement, number>
  staleBlocks: Set<HTMLElement>
}

export class ProseTypesetter {
  private disposed = false
  private enabled = false
  private readerEnabled = true
  private selectionDeferred = new Set<HTMLElement>()
  private generation = 0
  private frame: number | null = null
  private frameBackstop: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private content: TypesetContent | null = null
  private activeRun: TypesettingRun | null = null
  private desktopMedia = matchMedia("(min-width: 48rem)")
  private linebreaker: Linebreaker | null = null

  private handleViewportChange = () => this.syncEnabled()

  async start() {
    this.readerEnabled =
      document.documentElement.dataset.textJustification !== "ragged"
    this.enabled = this.readerEnabled && this.desktopMedia.matches
    this.content = discoverTypesetContent()
    if (this.content.blocks.length === 0) return

    this.desktopMedia.addEventListener("change", this.handleViewportChange)
    await document.fonts.ready
    if (this.disposed) return

    this.linebreaker = createLinebreaker({
      locale: document.documentElement.lang || "en-US",
      minimumWidth: layoutPolicy.minimumWidth,
      preserveImageAttributes: ["data-loaded"],
      resizeTolerance: layoutPolicy.resizeTolerance,
    })
    if (this.enabled) {
      this.startWidthObservation()
      this.retypeset()
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    this.cancelScheduled()
    this.stopWidthObservation()
    this.desktopMedia.removeEventListener("change", this.handleViewportChange)
    this.activeRun = null
    this.selectionDeferred.clear()
    this.linebreaker?.destroy()
    this.linebreaker = null
  }

  setEnabled(enabled: boolean) {
    this.readerEnabled = enabled
    this.syncEnabled()
  }

  refreshAfterSelection() {
    if (this.selectionDeferred.size === 0) return
    const blocks = [...this.selectionDeferred]
    this.selectionDeferred.clear()
    if (this.enabled) this.retypeset(blocks)
  }

  refreshLayout() {
    this.generation += 1
    this.cancelScheduled()
    this.activeRun = null
    this.invalidateAll()
    if (this.enabled) this.retypeset()
  }

  private syncEnabled() {
    const enabled = this.readerEnabled && this.desktopMedia.matches
    if (this.enabled === enabled) return
    this.enabled = enabled
    this.generation += 1
    this.cancelScheduled()

    if (enabled) {
      this.startWidthObservation()
      this.retypeset()
    } else {
      this.activeRun = null
      this.selectionDeferred.clear()
      const anchor = this.captureAnchor()
      this.restoreAll()
      this.stopWidthObservation()
      restoreReadingAnchor(anchor)
    }
  }

  private schedule(callback: () => void) {
    this.cancelScheduled()
    const run = () => {
      this.cancelScheduled()
      callback()
    }
    this.frame = requestAnimationFrame(run)
    this.frameBackstop = window.setTimeout(run, schedulingPolicy.frameBackstop)
  }

  private cancelScheduled() {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    if (this.frameBackstop !== null) clearTimeout(this.frameBackstop)
    this.frame = null
    this.frameBackstop = null
  }

  private startWidthObservation() {
    if (
      this.disposed ||
      !this.enabled ||
      !this.linebreaker ||
      this.resizeObserver ||
      !this.content ||
      this.content.blocks.length === 0
    ) {
      return
    }

    const widths = new WeakMap<HTMLElement, number>()
    const observer = new ResizeObserver((entries) => {
      if (this.disposed || this.resizeObserver !== observer) return
      this.syncEnabled()
      if (!this.enabled || this.resizeObserver !== observer) return

      const changedBlocks: HTMLElement[] = []
      for (const entry of entries) {
        const block = entry.target as HTMLElement
        const width = entry.contentRect.width
        const previous = widths.get(block)
        widths.set(block, width)
        if (
          previous !== undefined &&
          Math.abs(previous - width) > layoutPolicy.resizeTolerance
        ) {
          changedBlocks.push(block)
        }
      }

      if (changedBlocks.length === 0) return
      this.retypeset(changedBlocks)
    })
    this.resizeObserver = observer

    for (const block of this.content.blocks) {
      if (block.parentElement?.children.length === 1) {
        block.dataset.kpFlexMeasure = ""
      }
      observer.observe(block)
    }
  }

  private stopWidthObservation() {
    const observer = this.resizeObserver
    this.resizeObserver = null
    observer?.disconnect()
    for (const block of this.content?.blocks ?? []) {
      delete block.dataset.kpFlexMeasure
    }
  }

  private restoreAll() {
    if (!this.linebreaker) return
    this.linebreaker.restore(this.content?.blocks ?? [])
  }

  private invalidateAll() {
    if (!this.linebreaker) return
    this.linebreaker.invalidate(this.content?.blocks ?? [])
  }

  private captureAnchor() {
    return this.content ? captureReadingAnchor(this.content) : null
  }

  private retypeset(requestedBlocks?: Iterable<HTMLElement>) {
    if (this.disposed || !this.enabled || !this.linebreaker) return
    const linebreaker = this.linebreaker
    const previousRun = this.activeRun
    let blocks = [
      ...new Set([
        ...(previousRun?.blocks.slice(previousRun.index) ?? []),
        ...(previousRun?.staleBlocks ?? []),
        ...(requestedBlocks ?? this.content?.blocks ?? []),
      ]),
    ]
    if (requestedBlocks === undefined) {
      blocks = blocks.filter(
        (block) => block.clientWidth >= layoutPolicy.minimumWidth,
      )
    }
    blocks = prioritizeForReading(blocks)
    if (blocks.length === 0) return

    this.generation += 1
    const generation = this.generation
    const run: TypesettingRun = {
      blocks,
      index: 0,
      retryCounts: new Map(previousRun?.retryCounts),
      staleBlocks: new Set(),
    }
    this.activeRun = run
    const benchmarkStarted = benchmarkEnabled() ? performance.now() : null

    const work = () => {
      if (this.disposed || !this.enabled || generation !== this.generation) {
        return
      }

      const anchor = this.captureAnchor()
      const plans: LinebreakPlan[] = []
      const selectedRange = readSelectedRange()
      const started = performance.now()
      while (
        run.index < blocks.length &&
        performance.now() - started < schedulingPolicy.frameBudget
      ) {
        const block = blocks[run.index]
        run.index += 1
        if (selectedRange?.intersectsNode(block)) {
          this.selectionDeferred.add(block)
          continue
        }
        plans.push(linebreaker.plan(block))
        this.selectionDeferred.delete(block)
      }

      const results = linebreaker.commit(plans)
      for (const result of results) {
        if (result.state !== "stale") {
          run.retryCounts.delete(result.element)
          continue
        }

        const retryCount = run.retryCounts.get(result.element) ?? 0
        if (retryCount < schedulingPolicy.maximumStabilizationPasses) {
          run.retryCounts.set(result.element, retryCount + 1)
          run.staleBlocks.add(result.element)
        } else {
          run.retryCounts.delete(result.element)
        }
      }
      restoreReadingAnchor(anchor)

      if (run.index < blocks.length) {
        this.schedule(work)
      } else if (run.staleBlocks.size > 0) {
        this.schedule(() => {
          if (this.activeRun !== run) return
          this.retypeset(run.staleBlocks)
        })
      } else {
        if (this.activeRun === run) this.activeRun = null
        if (benchmarkStarted === null) return
        const target = document.querySelector<HTMLElement>(
          "prose-justification",
        )
        if (target) {
          const metrics = linebreaker.readMetrics()
          target.dataset.kpBenchmark = JSON.stringify({
            candidateBlocks: blocks.length,
            durationMilliseconds: performance.now() - benchmarkStarted,
            exactRetries: metrics.exactRetries,
            preparation: metrics.preparation,
          })
        }
      }
    }

    this.schedule(work)
  }
}
