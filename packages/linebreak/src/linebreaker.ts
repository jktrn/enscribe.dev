import {
  readyCompositions,
  reportOutcomes,
  statusFor,
} from "./browser/composition"
import type { PreparedLayoutOptions } from "./layout/breaker"
import { defaultGlue, resolvePolicy } from "./layout/policy"
import { engineDefaults, engineLimits } from "./policy"
import {
  honoursHangingMargins,
  renderLines,
  tightenOverset,
} from "./dom/render"
import { contentWidth, styleOf } from "./dom/geometry"
import {
  computedFont,
  cssPixels,
  firstLineIndent,
  variantKey,
} from "./dom/style"
import {
  COMPOSITION_BRAND,
  type Composition,
  type ComposeReason,
  type FailureReason,
  type Linebreaker,
  type LinebreakerOptions,
  type LinebreakerStats,
  type Outcome,
} from "./types"
import type {
  Draft,
  Measurement,
  MeasurementBasis,
  RenderJob,
  WrittenJob,
} from "./browser/state"
import { BrowserMeasurements } from "./browser/measurement"
import { BrowserCache } from "./browser/cache"
import { Drafts } from "./browser/drafts"
import {
  commonShift,
  layoutFor,
  unsupportedIn,
  verifyLayout,
} from "./browser/layout"

const TRANSIENT: ReadonlySet<string> = new Set(["already-typeset"])

const WIDTH_DEPENDENT: ReadonlySet<string> = new Set([
  "no-feasible-breaking",
  "unstable-width",
])

class BrowserLinebreaker implements Linebreaker {
  private readonly minimumWidth: number
  private readonly safetyMargin: number
  private readonly maximumRetries: number
  private readonly defaultLocale: string | undefined
  private readonly preservedImageAttributes: readonly string[]
  private readonly protrude: boolean
  private readonly layoutSettings: PreparedLayoutOptions
  private readonly report: ((outcome: Outcome) => void) | undefined

  private readonly measurements: BrowserCache
  private readonly live = new Set<HTMLElement>()
  private readonly remembered = new Map<
    HTMLElement,
    ComposeReason | FailureReason
  >()
  private readonly measurer: BrowserMeasurements
  private readonly drafts: Drafts
  private readonly counters = {
    typeset: 0,
    skipped: 0,
    declined: 0,
    failed: 0,
    retries: 0,
  }
  private disposed = false
  private writing = false
  private readonly hangable = new WeakMap<Document, boolean>()

  constructor(options: LinebreakerOptions = {}) {
    const limits = engineLimits(options)
    this.minimumWidth = limits.minimumWidth
    this.safetyMargin = limits.safetyMargin
    this.maximumRetries = limits.maximumRetries
    this.defaultLocale = options.locale || undefined
    this.preservedImageAttributes = options.preserveImageAttributes ?? []
    this.measurements = new BrowserCache(
      this.live,
      this.preservedImageAttributes,
    )
    this.drafts = new Drafts(this.preservedImageAttributes)
    this.protrude = options.protrude ?? true
    const policy = resolvePolicy(options.policy)
    this.layoutSettings = {
      policy,
      emergencyStretch: options.emergencyStretch,
      lastLineMinWidth:
        options.lastLineMinWidth ?? engineDefaults.lastLineMinWidth,
    }
    this.measurer = new BrowserMeasurements({
      maximumCharacters: limits.maximumCharacters,
      hyphenate: options.hyphenate,
      expand: options.expand ?? false,
      track: options.track ?? false,
      policy,
      glue: { ...defaultGlue, ...options.glue },
    })
    this.report = options.onOutcome
  }

  warm(document: Document) {
    this.assertUsable()
    if (!this.protrude) return
    this.hangingFor(document)
  }

  compose(elements: Iterable<HTMLElement>): readonly Composition[] {
    this.assertUsable()
    const out: Composition[] = []
    const seen = new Set<HTMLElement>()
    for (const element of elements) {
      if (seen.has(element)) continue
      seen.add(element)
      out.push(this.composeOne(element))
    }
    return out
  }

  apply(compositions: Iterable<Composition>): readonly Outcome[] {
    this.assertUsable()
    if (this.writing) {
      throw new TypeError(
        "linebreak: apply() re-entered, probably from an onOutcome handler",
      )
    }

    const order = [...new Set(compositions)]
    const results = new Map<Composition, Outcome>()
    const ready = readyCompositions(order, results, this.drafts)

    this.writing = true
    try {
      const written = ready.filter((composition) =>
        this.write(composition, results),
      )
      this.settle(written, results)
      this.forgetDisconnected()
      return reportOutcomes(order, results, this.counters, this.report)
    } finally {
      this.writing = false
      for (const composition of order) this.drafts.delete(composition)
    }
  }

  private forgetDisconnected() {
    for (const elements of [this.live, this.remembered]) {
      for (const element of elements.keys()) {
        if (!element.isConnected) elements.delete(element)
      }
    }
  }

  typeset(elements: Iterable<HTMLElement>): readonly Outcome[] {
    return this.apply(this.compose(elements))
  }

  restore(elements?: Iterable<HTMLElement>) {
    if (!elements) this.drafts.clear()
    for (const element of elements ?? [...this.live]) {
      this.restoreElement(element)
    }
  }

  reset(elements?: Iterable<HTMLElement>) {
    if (!elements) this.drafts.clear()
    for (const element of elements ?? [...this.live]) {
      this.restoreElement(element)
      this.measurements.delete(element)
      this.remembered.delete(element)
    }
    if (!elements) {
      this.remembered.clear()
      this.measurements.clear()
    }
    this.measurer.invalidate()
  }

  fontsMoved(document: Document) {
    return this.measurer.fontsMoved(document)
  }

  refresh() {
    for (const [element, reason] of this.remembered) {
      if (WIDTH_DEPENDENT.has(reason)) this.remembered.delete(element)
    }
  }

  stats(): LinebreakerStats {
    return {
      ...this.counters,
      liveElements: this.live.size,
      cachedFonts: this.measurer.size,
    }
  }

  dispose() {
    if (this.disposed) return
    this.restore()
    this.remembered.clear()
    this.measurements.clear()
    this.measurer.clear()
    this.disposed = true
  }

  private assertUsable() {
    if (this.disposed) {
      throw new TypeError("linebreak: this linebreaker has been disposed")
    }
  }

  private settled(
    element: HTMLElement,
    status: "skipped" | "declined" | "failed",
    reason: ComposeReason | FailureReason,
    width = 0,
  ): Composition {
    const composition = {
      brand: COMPOSITION_BRAND,
      element,
      status,
      lines: 0,
      width,
      reason,
    } as Composition
    this.drafts.set(composition)
    return composition
  }

  private remember(
    element: HTMLElement,
    reason: ComposeReason | FailureReason,
    width = 0,
  ): Composition {
    this.remembered.set(element, reason)
    return this.settled(element, statusFor(reason), reason, width)
  }

  private localeFor(element: HTMLElement) {
    return (
      element.closest<HTMLElement>("[lang]")?.getAttribute("lang") ||
      this.defaultLocale ||
      element.ownerDocument.documentElement.lang ||
      "en-US"
    )
  }

  private draftFor(
    element: HTMLElement,
    measurement: Measurement,
    width: number,
    indent: number,
  ): Composition {
    const solved = measurement.prepared.breakParagraph(
      width - this.safetyMargin,
      { ...this.layoutSettings, indent },
    )
    if (!solved.ok) {
      return this.remember(element, "no-feasible-breaking")
    }
    if (solved.lines.length < 2) {
      return this.settled(element, "skipped", "single-line", width)
    }

    const composition = {
      brand: COMPOSITION_BRAND,
      element,
      status: "ready",
      lines: solved.lines.length,
      width,
    } as Composition
    this.drafts.set(composition, {
      measurement,
      width,
      indent,
      lines: solved.lines,
      reduction: 0,
      round: 0,
    })
    return composition
  }

  private composeOne(element: HTMLElement): Composition {
    this.drafts.invalidate(element)
    const already = this.remembered.get(element)
    if (already !== undefined) {
      return this.settled(element, statusFor(already), already)
    }

    const style = styleOf(element)
    const unsupported = unsupportedIn(style)
    if (unsupported) return this.remember(element, unsupported)

    const width = contentWidth(element, style)
    if (width < this.minimumWidth) {
      return this.settled(element, "skipped", "too-narrow", width)
    }

    const basis: MeasurementBasis = {
      locale: this.localeFor(element),
      font: computedFont(style),
      letterSpacing: cssPixels(style.letterSpacing),
      variant: variantKey(style),
    }
    let measurement = this.measurements.get(element, basis)
    if (!measurement) {
      const built = this.measurer.build(
        element,
        style,
        basis,
        this.protrudes(element),
      )
      if (!built.ok) {
        return TRANSIENT.has(built.reason)
          ? this.settled(element, statusFor(built.reason), built.reason, width)
          : this.remember(element, built.reason, width)
      }
      measurement = built.measurement
      this.measurements.set(element, measurement)
    }

    return this.draftFor(
      element,
      measurement,
      width,
      firstLineIndent(style, width),
    )
  }

  private write(
    job: RenderJob,
    results: Map<Composition, Outcome>,
  ): job is WrittenJob {
    const { composition, draft } = job
    const { element } = composition
    const target = draft.width - this.safetyMargin - draft.reduction

    if (draft.reduction > 0) {
      const solved = draft.measurement.prepared.breakParagraph(target, {
        ...this.layoutSettings,
        indent: draft.indent,
      })
      if (!solved.ok) {
        this.revert(composition, "layout-mismatch", results)
        return false
      }
      draft.lines = solved.lines
    }

    try {
      const layout = layoutFor(draft, target)
      const written = renderLines(
        element,
        draft.measurement.block,
        layout,
        this.preservedImageAttributes,
      )
      if (!written) throw new Error("line content could not be rebuilt")
      draft.written = { elements: written, layout }
      this.live.add(element)
      return true
    } catch (cause) {
      this.revert(
        composition,
        "render-failed",
        results,
        cause instanceof Error
          ? cause
          : new Error("Rendering threw a non-Error value"),
      )
      return false
    }
  }

  private settle(
    written: readonly WrittenJob[],
    results: Map<Composition, Outcome>,
  ) {
    let pending = written
    while (pending.length > 0) {
      const retry: WrittenJob[] = []
      tightenOverset(pending.map((job) => job.draft.written))
      const shift = commonShift(pending)

      for (const composition of pending) {
        if (this.settleOne(composition, shift, results)) retry.push(composition)
      }

      pending = retry.filter((composition) => this.write(composition, results))
    }
  }

  private scheduleRetry(draft: Draft) {
    draft.round += 1
    this.counters.retries += 1
    draft.reduction =
      draft.width * engineDefaults.retryReduction * 3 ** (draft.round - 1)
  }

  private settleOne(
    job: WrittenJob,
    shift: number,
    results: Map<Composition, Outcome>,
  ) {
    const { composition, draft } = job

    const failure = verifyLayout(
      composition.element,
      draft.written,
      draft.width + shift,
    )
    if (!failure) {
      this.measurements.written(composition.element)
      results.set(composition, {
        element: composition.element,
        status: "typeset",
        lines: draft.lines.length,
        retries: draft.round,
      })
      return false
    }

    if (failure === "layout-mismatch" && draft.round < this.maximumRetries) {
      this.scheduleRetry(draft)
      return true
    }

    this.revert(composition, failure, results)
    return false
  }

  private protrudes(element: HTMLElement) {
    if (!this.protrude) return false
    return this.hangingFor(element.ownerDocument)
  }

  private hangingFor(document: Document) {
    let support = this.hangable.get(document)
    if (support === undefined) {
      support = honoursHangingMargins(document)
      this.hangable.set(document, support)
    }
    return support
  }

  private revert(
    composition: Composition,
    reason: FailureReason,
    results: Map<Composition, Outcome>,
    cause?: Error,
  ) {
    this.measurements.restore(composition.element, true)
    if (reason !== "layout-mismatch") {
      this.remembered.set(composition.element, reason)
    }
    results.set(composition, {
      element: composition.element,
      status: "failed",
      reason,
      cause,
    })
  }

  private restoreElement(element: HTMLElement) {
    this.drafts.invalidate(element)
    this.measurements.restore(element)
  }
}

export const createLinebreaker = (
  options: LinebreakerOptions = {},
): Linebreaker => new BrowserLinebreaker(options)
