import { breakParagraph, type Line } from "./layout/breaker"
import { compileBlock } from "./layout/compile"
import type { Item } from "./layout/items"
import { defaultGlue, resolvePolicy } from "./layout/policy"
import {
  type ExtractedBlock,
  extractBlock,
  type InlineRun,
  outerWidth,
} from "./dom/extract"
import {
  configureLocale,
  createFontMetrics,
  type FontMetrics,
} from "./text/measure"
import { engineDefaults } from "./policy"
import { LINE_SELECTOR, renderLines, TYPESET_ATTRIBUTE } from "./dom/render"
import {
  type AuthoredContent,
  authoredText,
  captureAuthored,
  restoreAuthored,
} from "./dom/restore"
import {
  computedFont,
  createStyleReader,
  cssPixels,
  unmodellableProperty,
} from "./dom/style"
import {
  COMPOSITION_BRAND,
  type Composition,
  type ComposeReason,
  type DeclineReason,
  type FailureReason,
  type Linebreaker,
  type LinebreakerOptions,
  type LinebreakerStats,
  type Outcome,
  type SkipReason,
} from "./types"

type MeasurementBasis = {
  readonly locale: string
  readonly font: string
  readonly letterSpacing: number
}

type Measurement = {
  readonly block: ExtractedBlock
  readonly items: Item[]
  readonly authored: AuthoredContent
  readonly under: MeasurementBasis
  readonly text: string
}

type Draft = {
  readonly measurement: Measurement
  readonly width: number
  lines: readonly Line[]
  reduction: number
  round: number
}

const sameBasis = (a: MeasurementBasis, b: MeasurementBasis) =>
  a.locale === b.locale &&
  a.font === b.font &&
  a.letterSpacing === b.letterSpacing

const SKIP_REASONS: ReadonlySet<string> = new Set([
  "single-line",
  "empty",
  "too-narrow",
  "already-typeset",
])

const TRANSIENT: ReadonlySet<string> = new Set(["already-typeset"])

const RETRYABLE: ReadonlySet<string> = new Set(["too-narrow", "single-line"])

const viewOf = (element: HTMLElement) =>
  element.ownerDocument.defaultView ?? globalThis

const styleOf = (element: HTMLElement) =>
  viewOf(element).getComputedStyle(element)

const contentWidth = (element: HTMLElement, style: CSSStyleDeclaration) =>
  element.clientWidth -
  cssPixels(style.paddingInlineStart) -
  cssPixels(style.paddingInlineEnd)

const resolvedLineHeight = (style: CSSStyleDeclaration) => {
  const value = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(value)) return value
  const fontSize = Number.parseFloat(style.fontSize)
  return Number.isFinite(fontSize) ? fontSize * 1.2 : Number.NaN
}

const layoutMismatch = (element: HTMLElement, lineCount: number) => {
  const segments = element.querySelectorAll<HTMLElement>(LINE_SELECTOR)
  if (segments.length !== lineCount) return true

  const rows = new Set<number>()
  for (const segment of segments) {
    const rect = segment.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    rows.add(Math.round(rect.top))
  }
  if (rows.size !== lineCount) return true

  return element.scrollWidth > element.clientWidth + 1
}

class BrowserLinebreaker implements Linebreaker {
  private readonly minimumWidth: number
  private readonly safetyMargin: number
  private readonly maximumRetries: number
  private readonly defaultLocale: string | undefined
  private readonly preservedImageAttributes: readonly string[]
  private readonly hyphenate: boolean
  private readonly policy: ReturnType<typeof resolvePolicy>
  private readonly glue: { stretch: number; shrink: number }
  private readonly report: ((outcome: Outcome) => void) | undefined

  private readonly measurements = new WeakMap<HTMLElement, Measurement>()
  private readonly live = new Set<HTMLElement>()
  private readonly remembered = new Map<
    HTMLElement,
    SkipReason | DeclineReason
  >()
  private readonly metrics = new Map<string, FontMetrics>()
  private readonly drafts = new WeakMap<Composition, Draft>()
  private readonly counters = {
    typeset: 0,
    skipped: 0,
    declined: 0,
    failed: 0,
    retries: 0,
  }
  private disposed = false
  private writing = false

  constructor(options: LinebreakerOptions = {}) {
    this.minimumWidth = options.minimumWidth ?? engineDefaults.minimumWidth
    this.safetyMargin = options.safetyMargin ?? engineDefaults.safetyMargin
    this.maximumRetries = options.retries ?? engineDefaults.retries
    this.defaultLocale = options.locale || undefined
    this.preservedImageAttributes = options.preserveImageAttributes ?? []
    this.hyphenate = options.hyphenate ?? false
    this.policy = resolvePolicy(options.policy)
    this.glue = { ...defaultGlue, ...options.glue }
    this.report = options.onOutcome
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

    const order = [...compositions]
    const results = new Map<Composition, Outcome>()
    const ready: Composition[] = []

    for (const composition of order) {
      if (composition?.brand !== COMPOSITION_BRAND) {
        throw new TypeError("linebreak: apply() received a foreign composition")
      }
      if (composition.status === "ready") {
        if (!this.drafts.has(composition)) {
          throw new TypeError("linebreak: this composition was already applied")
        }
        ready.push(composition)
        continue
      }
      results.set(composition, {
        element: composition.element,
        status: composition.status,
        reason: composition.reason,
      } as Outcome)
    }

    this.writing = true
    try {
      const written = ready.filter((composition) =>
        this.write(composition, results),
      )
      this.settle(written, results)
    } finally {
      this.writing = false
      for (const composition of ready) this.drafts.delete(composition)
    }

    for (const element of this.live) {
      if (!element.isConnected) this.live.delete(element)
    }

    const outcomes = order.map(
      (composition): Outcome =>
        results.get(composition) ?? {
          element: composition.element,
          status: "failed",
          reason: "render-failed",
        },
    )
    for (const outcome of outcomes) {
      if (outcome.status === "skipped") this.counters.skipped += 1
      if (outcome.status === "declined") this.counters.declined += 1
      this.report?.(outcome)
    }
    return outcomes
  }

  typeset(elements: Iterable<HTMLElement>): readonly Outcome[] {
    return this.apply(this.compose(elements))
  }

  restore(elements?: Iterable<HTMLElement>) {
    for (const element of elements ?? [...this.live]) {
      this.restoreElement(element)
    }
  }

  reset(elements?: Iterable<HTMLElement>) {
    for (const element of elements ?? [...this.live]) {
      this.restoreElement(element)
      this.measurements.delete(element)
      this.remembered.delete(element)
    }
    if (!elements) {
      this.remembered.clear()
      this.metrics.clear()
    }
  }

  refresh() {
    for (const [element, reason] of this.remembered) {
      if (RETRYABLE.has(reason)) this.remembered.delete(element)
    }
  }

  stats(): LinebreakerStats {
    return {
      ...this.counters,
      liveElements: this.live.size,
      cachedFonts: this.metrics.size,
    }
  }

  dispose() {
    if (this.disposed) return
    this.restore()
    this.live.clear()
    this.remembered.clear()
    this.metrics.clear()
    this.disposed = true
  }

  private assertUsable() {
    if (this.disposed) {
      throw new TypeError("linebreak: this linebreaker has been disposed")
    }
  }

  private settled(
    element: HTMLElement,
    status: "skipped" | "declined",
    reason: SkipReason | DeclineReason,
    width = 0,
    remember = true,
  ): Composition {
    if (remember) this.remembered.set(element, reason)
    return {
      brand: COMPOSITION_BRAND,
      element,
      status,
      lines: 0,
      width,
      reason,
    } as Composition
  }

  private composeOne(element: HTMLElement): Composition {
    const already = this.remembered.get(element)
    if (already !== undefined) {
      const status = RETRYABLE.has(already) ? "skipped" : "declined"
      return this.settled(element, status as "skipped", already, 0, false)
    }

    const style = styleOf(element)
    if (style.direction !== "ltr") {
      return this.settled(element, "declined", "unsupported-direction")
    }
    const writingMode = style.writingMode
    if (writingMode && !writingMode.startsWith("horizontal")) {
      return this.settled(element, "declined", "unsupported-writing-mode")
    }

    const width = contentWidth(element, style)
    if (width < this.minimumWidth) {
      return this.settled(element, "skipped", "too-narrow", width, false)
    }

    const locale =
      element.closest<HTMLElement>("[lang]")?.getAttribute("lang") ||
      this.defaultLocale ||
      element.ownerDocument.documentElement.lang ||
      "en-US"

    const basis: MeasurementBasis = {
      locale,
      font: computedFont(style),
      letterSpacing: cssPixels(style.letterSpacing),
    }
    const ours = element.hasAttribute(TYPESET_ATTRIBUTE)
    let measurement = this.measurements.get(element)
    if (
      measurement &&
      (!sameBasis(measurement.under, basis) ||
        (!ours && measurement.text !== authoredText(element)))
    ) {
      this.restoreElement(element)
      this.measurements.delete(element)
      measurement = undefined
    }
    if (!measurement) {
      const built = this.measure(element, style, basis)
      if (!built.ok) {
        const status = SKIP_REASONS.has(built.reason) ? "skipped" : "declined"
        return this.settled(
          element,
          status as "skipped",
          built.reason,
          width,
          !TRANSIENT.has(built.reason),
        )
      }
      measurement = built.measurement
      this.measurements.set(element, measurement)
    }

    const solved = breakParagraph(
      measurement.items,
      width - this.safetyMargin,
      { policy: this.policy },
    )
    if (!solved.ok) {
      return this.settled(element, "declined", "no-feasible-breaking")
    }
    if (solved.lines.length < 2) {
      return this.settled(element, "skipped", "single-line", width, false)
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
      lines: solved.lines,
      reduction: 0,
      round: 0,
    })
    return composition
  }

  private write(
    composition: Composition,
    results: Map<Composition, Outcome>,
  ): boolean {
    const draft = this.drafts.get(composition)
    if (!draft) return false
    const { element } = composition
    const target = draft.width - this.safetyMargin - draft.reduction

    if (draft.reduction > 0) {
      const solved = breakParagraph(draft.measurement.items, target, {
        policy: this.policy,
      })
      if (!solved.ok) {
        this.revert(composition, "no-feasible-breaking", results)
        return false
      }
      draft.lines = solved.lines
    }

    try {
      const written = renderLines(
        element,
        draft.measurement.block,
        draft.lines,
        target,
        this.preservedImageAttributes,
      )
      if (!written) throw new Error("line content could not be rebuilt")
      this.live.add(element)
      return true
    } catch (cause) {
      this.revert(composition, "render-failed", results, cause)
      return false
    }
  }

  private settle(
    written: readonly Composition[],
    results: Map<Composition, Outcome>,
  ) {
    let pending = written
    while (pending.length > 0) {
      const retry: Composition[] = []
      const shift = this.commonShift(pending)

      for (const composition of pending) {
        const draft = this.drafts.get(composition)
        if (!draft) continue
        const failure = this.verify(
          composition.element,
          draft.lines.length,
          draft.width + shift,
        )
        if (!failure) {
          this.counters.typeset += 1
          results.set(composition, {
            element: composition.element,
            status: "typeset",
            lines: draft.lines.length,
            retries: draft.round,
          })
          continue
        }
        if (
          failure === "layout-mismatch" &&
          draft.round < this.maximumRetries
        ) {
          draft.round += 1
          this.counters.retries += 1
          draft.reduction =
            draft.width * engineDefaults.retryReduction * 3 ** (draft.round - 1)
          retry.push(composition)
          continue
        }
        this.revert(composition, failure, results)
      }

      pending = retry.filter((composition) => this.write(composition, results))
    }
  }

  private commonShift(pending: readonly Composition[]): number {
    const deltas: number[] = []
    for (const composition of pending) {
      const draft = this.drafts.get(composition)
      if (!draft) continue
      const observed = contentWidth(
        composition.element,
        styleOf(composition.element),
      )
      deltas.push(observed - draft.width)
    }
    if (deltas.length === 0) return 0
    deltas.sort((a, b) => a - b)
    const middle = deltas.length >> 1
    return deltas.length % 2
      ? (deltas[middle] as number)
      : ((deltas[middle - 1] as number) + (deltas[middle] as number)) / 2
  }

  private verify(
    element: HTMLElement,
    lineCount: number,
    expectedWidth: number,
  ): FailureReason | null {
    const style = styleOf(element)

    if (Math.abs(contentWidth(element, style) - expectedWidth) > 1) {
      return "unstable-width"
    }
    if (!Number.isFinite(resolvedLineHeight(style))) {
      return "line-height-unresolved"
    }
    return layoutMismatch(element, lineCount) ? "layout-mismatch" : null
  }

  private revert(
    composition: Composition,
    reason: FailureReason,
    results: Map<Composition, Outcome>,
    cause?: unknown,
  ) {
    this.restoreElement(composition.element)
    this.counters.failed += 1
    if (reason !== "layout-mismatch") {
      this.remembered.set(
        composition.element,
        reason as unknown as DeclineReason,
      )
    }
    results.set(composition, {
      element: composition.element,
      status: "failed",
      reason,
      cause,
    })
  }

  private restoreElement(element: HTMLElement) {
    const measurement = this.measurements.get(element)
    if (measurement) {
      restoreAuthored(
        element,
        measurement.authored,
        this.preservedImageAttributes,
      )
    }
    this.live.delete(element)
  }

  private metricsFor(font: string, letterSpacing: number, locale: string) {
    const key = `${locale}|${letterSpacing}|${font}`
    const cached = this.metrics.get(key)
    if (cached) return cached
    const metrics = createFontMetrics(font, letterSpacing)
    this.metrics.set(key, metrics)
    return metrics
  }

  private measure(
    element: HTMLElement,
    style: CSSStyleDeclaration,
    basis: MeasurementBasis,
  ):
    | { ok: true; measurement: Measurement }
    | { ok: false; reason: ComposeReason } {
    if (element.hasAttribute(TYPESET_ATTRIBUTE)) {
      return { ok: false, reason: "already-typeset" }
    }

    const reader = createStyleReader(element, style)
    const extracted = extractBlock(element, reader)
    if (!extracted.ok) return { ok: false, reason: extracted.reason }

    configureLocale(basis.locale)
    let unmodellable: ComposeReason | null = null

    const metricsFor = (run: InlineRun): FontMetrics | null => {
      const runStyle = reader(run.sourceElement)
      if (unmodellableProperty(runStyle)) {
        unmodellable ??= "unmeasurable"
        return null
      }
      return this.metricsFor(
        computedFont(runStyle),
        cssPixels(runStyle.letterSpacing),
        basis.locale,
      )
    }

    const text = authoredText(element)
    const authored = captureAuthored(element)
    const compiled = compileBlock({
      block: extracted.block,
      metricsFor,
      atomWidth: (run: InlineRun) => outerWidth(run.sourceElement, reader),
      locale: basis.locale,
      hyphenate: this.hyphenate,
      policy: this.policy,
      glue: this.glue,
    })
    if (unmodellable) return { ok: false, reason: unmodellable }
    if (!compiled.ok) return { ok: false, reason: compiled.reason }

    return {
      ok: true,
      measurement: {
        block: extracted.block,
        items: compiled.items,
        authored,
        under: basis,
        text,
      },
    }
  }
}

export const createLinebreaker = (
  options: LinebreakerOptions = {},
): Linebreaker => new BrowserLinebreaker(options)
