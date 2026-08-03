import { breakParagraph, type Line } from "./layout/breaker"
import { compileBlock } from "./layout/compile"
import type { Item } from "./layout/items"
import { fitLines } from "./layout/expansion"
import { trackLines } from "./layout/tracking"
import type { Flex } from "./layout/flex"
import type { Hangs } from "./layout/protrusion"
import { defaultGlue, resolvePolicy } from "./layout/policy"
import {
  type ExtractedBlock,
  extractBlock,
  type InlineRun,
  outerWidth,
} from "./dom/extract"
import {
  configureLocale,
  type FontMetrics,
  invalidateMeasurements,
} from "./text/measure"
import { engineDefaults } from "./policy"
import type { StretchScale } from "./text/stretch"
import { invalidateStretchScales, stretchScaleFor } from "./dom/stretch"
import { metricsForStyle } from "./dom/measure-dom"
import {
  honoursHangingMargins,
  LINE_SELECTOR,
  renderLines,
  type RenderedLayout,
  tightenOverset,
  TYPESET_ATTRIBUTE,
  type WrittenLines,
} from "./dom/render"
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
  firstLineIndent,
  indentsSomeOtherLine,
  type StyleReader,
  uniformLetterSpacing,
  unmodellableProperty,
  variantKey,
} from "./dom/style"
import {
  COMPOSITION_BRAND,
  type Composition,
  type ComposeReason,
  DECLINE_REASONS,
  SKIP_REASONS,
  type DeclineReason,
  type FailureReason,
  type Hyphenator,
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
  readonly hangs: Hangs | null
  readonly expansion: Flex | null
  readonly tracking: Flex | null
  readonly flex: Flex | null
  readonly scale: StretchScale | null
  readonly authored: AuthoredContent
  readonly under: MeasurementBasis
  readonly text: string
}

type Draft = {
  readonly measurement: Measurement
  readonly width: number
  readonly indent: number
  lines: readonly Line[]
  reduction: number
  round: number
  written?: WrittenLines
}

const sameBasis = (a: MeasurementBasis, b: MeasurementBasis) =>
  a.locale === b.locale &&
  a.font === b.font &&
  a.letterSpacing === b.letterSpacing

const SKIPPED: ReadonlySet<string> = new Set(SKIP_REASONS)
const DECLINED: ReadonlySet<string> = new Set(DECLINE_REASONS)

const TRANSIENT: ReadonlySet<string> = new Set(["already-typeset"])

const WIDTH_DEPENDENT: ReadonlySet<string> = new Set([
  "no-feasible-breaking",
  "unstable-width",
])

const statusFor = (reason: string) => {
  if (SKIPPED.has(reason)) return "skipped" as const
  if (DECLINED.has(reason)) return "declined" as const
  return "failed" as const
}

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

const hangSlack = (lines: readonly Line[]) => {
  let most = 0
  for (const line of lines) {
    if (line.hangEnd > most) most = line.hangEnd
  }
  return most
}

const layoutMismatch = (
  element: HTMLElement,
  lineCount: number,
  slack: number,
) => {
  const segments = element.querySelectorAll<HTMLElement>(LINE_SELECTOR)
  if (segments.length !== lineCount) return true

  const rows = new Set<number>()
  for (const segment of segments) {
    const rect = segment.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    rows.add(Math.round(rect.top))
  }
  if (rows.size !== lineCount) return true

  return element.scrollWidth > element.clientWidth + 1 + slack
}

const engineLimits = (options: LinebreakerOptions) => ({
  minimumWidth: options.minimumWidth ?? engineDefaults.minimumWidth,
  safetyMargin: options.safetyMargin ?? engineDefaults.safetyMargin,
  maximumRetries: options.retries ?? engineDefaults.retries,
  maximumCharacters:
    options.maximumCharacters ?? engineDefaults.maximumCharacters,
})

class BrowserLinebreaker implements Linebreaker {
  private readonly minimumWidth: number
  private readonly safetyMargin: number
  private readonly maximumRetries: number
  private readonly maximumCharacters: number
  private readonly defaultLocale: string | undefined
  private readonly preservedImageAttributes: readonly string[]
  private readonly hyphenate: Hyphenator | undefined
  private readonly protrude: boolean
  private readonly expand: boolean
  private readonly track: boolean
  private readonly lastLineMinWidth: number
  private readonly policy: ReturnType<typeof resolvePolicy>
  private readonly glue: { stretch: number; shrink: number }
  private readonly report: ((outcome: Outcome) => void) | undefined

  private readonly measurements = new WeakMap<HTMLElement, Measurement>()
  private readonly live = new Set<HTMLElement>()
  private readonly remembered = new Map<
    HTMLElement,
    ComposeReason | FailureReason
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
  private hangable: boolean | null = null

  constructor(options: LinebreakerOptions = {}) {
    const limits = engineLimits(options)
    this.minimumWidth = limits.minimumWidth
    this.safetyMargin = limits.safetyMargin
    this.maximumRetries = limits.maximumRetries
    this.maximumCharacters = limits.maximumCharacters
    this.defaultLocale = options.locale || undefined
    this.preservedImageAttributes = options.preserveImageAttributes ?? []
    this.hyphenate = options.hyphenate
    this.protrude = options.protrude ?? true
    this.expand = options.expand ?? false
    this.track = options.track ?? false
    this.lastLineMinWidth =
      options.lastLineMinWidth ?? engineDefaults.lastLineMinWidth
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
    const ready = this.readyOf(order, results)

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

    this.forgetDisconnected()
    return this.reportAll(order, results)
  }

  private readyOf(
    order: readonly Composition[],
    results: Map<Composition, Outcome>,
  ) {
    const ready: Composition[] = []
    for (const composition of order) {
      if (composition?.brand !== COMPOSITION_BRAND) {
        throw new TypeError("linebreak: apply() received a foreign composition")
      }
      if (composition.status !== "ready") {
        results.set(composition, {
          element: composition.element,
          status: composition.status,
          reason: composition.reason,
        } as Outcome)
        continue
      }
      if (!this.drafts.has(composition)) {
        throw new TypeError("linebreak: this composition was already applied")
      }
      ready.push(composition)
    }
    return ready
  }

  private forgetDisconnected() {
    for (const element of this.live) {
      if (!element.isConnected) this.live.delete(element)
    }
  }

  private reportAll(
    order: readonly Composition[],
    results: Map<Composition, Outcome>,
  ) {
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
    if (!elements) this.remembered.clear()
    this.metrics.clear()
    invalidateMeasurements()
    invalidateStretchScales()
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
    status: "skipped" | "declined" | "failed",
    reason: ComposeReason | FailureReason,
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

  private unsupportedIn(style: CSSStyleDeclaration) {
    if (style.direction !== "ltr") return "unsupported-direction" as const
    const writingMode = style.writingMode
    if (writingMode && !writingMode.startsWith("horizontal")) {
      return "unsupported-writing-mode" as const
    }
    if (indentsSomeOtherLine(style)) return "unmeasurable" as const
    return null
  }

  private localeFor(element: HTMLElement) {
    return (
      element.closest<HTMLElement>("[lang]")?.getAttribute("lang") ||
      this.defaultLocale ||
      element.ownerDocument.documentElement.lang ||
      "en-US"
    )
  }

  private reusableMeasurement(element: HTMLElement, basis: MeasurementBasis) {
    const measurement = this.measurements.get(element)
    if (!measurement) return undefined
    if (
      measurement.text === authoredText(element) &&
      sameBasis(measurement.under, basis)
    ) {
      return measurement
    }
    this.restoreElement(element)
    this.measurements.delete(element)
    return undefined
  }

  private draftFor(
    element: HTMLElement,
    measurement: Measurement,
    width: number,
    indent: number,
  ): Composition {
    const solved = breakParagraph(
      measurement.items,
      width - this.safetyMargin,
      this.layoutOptions(measurement, indent),
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
      indent,
      lines: solved.lines,
      reduction: 0,
      round: 0,
    })
    return composition
  }

  private composeOne(element: HTMLElement): Composition {
    const already = this.remembered.get(element)
    if (already !== undefined) {
      return this.settled(element, statusFor(already), already, 0, false)
    }

    const style = styleOf(element)
    const unsupported = this.unsupportedIn(style)
    if (unsupported) return this.settled(element, "declined", unsupported)

    const width = contentWidth(element, style)
    if (width < this.minimumWidth) {
      return this.settled(element, "skipped", "too-narrow", width, false)
    }

    const basis: MeasurementBasis = {
      locale: this.localeFor(element),
      font: computedFont(style),
      letterSpacing: cssPixels(style.letterSpacing),
    }
    let measurement = this.reusableMeasurement(element, basis)
    if (!measurement) {
      const built = this.measure(element, style, basis)
      if (!built.ok) {
        return this.settled(
          element,
          statusFor(built.reason),
          built.reason,
          width,
          !TRANSIENT.has(built.reason),
        )
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
    composition: Composition,
    results: Map<Composition, Outcome>,
  ): boolean {
    const draft = this.drafts.get(composition)
    if (!draft) return false
    const { element } = composition
    const target = draft.width - this.safetyMargin - draft.reduction

    if (draft.reduction > 0) {
      const solved = breakParagraph(
        draft.measurement.items,
        target,
        this.layoutOptions(draft.measurement, draft.indent),
      )
      if (!solved.ok) {
        this.revert(composition, "layout-mismatch", results)
        return false
      }
      draft.lines = solved.lines
    }

    try {
      const layout = this.layoutFor(draft, target)
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
      tightenOverset(this.writtenLines(pending))
      const shift = this.commonShift(pending)

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
    composition: Composition,
    shift: number,
    results: Map<Composition, Outcome>,
  ) {
    const draft = this.drafts.get(composition)
    if (!draft) return false

    const failure = this.verify(
      composition.element,
      draft.lines,
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
      return false
    }

    if (failure === "layout-mismatch" && draft.round < this.maximumRetries) {
      this.scheduleRetry(draft)
      return true
    }

    this.revert(composition, failure, results)
    return false
  }

  private *writtenLines(pending: readonly Composition[]) {
    for (const composition of pending) {
      const written = this.drafts.get(composition)?.written
      if (written) yield written
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
    if (deltas.length < 2) return 0
    deltas.sort((a, b) => a - b)
    const middle = deltas.length >> 1
    return deltas.length % 2
      ? (deltas[middle] as number)
      : ((deltas[middle - 1] as number) + (deltas[middle] as number)) / 2
  }

  private protrudes(element: HTMLElement) {
    if (!this.protrude) return false
    this.hangable ??= honoursHangingMargins(element.ownerDocument)
    return this.hangable
  }

  private expandsWith(
    element: HTMLElement,
    reader: StyleReader,
    basis: MeasurementBasis,
  ): ((run: InlineRun) => StretchScale | null) | null {
    if (!this.expand) return null
    const document = element.ownerDocument
    const budget = engineDefaults.expansionBudget
    if (!stretchScaleFor(document, basis.font, basis.letterSpacing, budget)) {
      return null
    }
    return (run) => {
      const style = reader(run.sourceElement)
      return stretchScaleFor(
        document,
        computedFont(style),
        cssPixels(style.letterSpacing),
        budget,
      )
    }
  }

  private tracksWith(
    block: ExtractedBlock,
    reader: StyleReader,
    basis: MeasurementBasis,
  ) {
    if (!this.track) return null
    const elements = block.runs.map((run) => run.sourceElement)
    if (!uniformLetterSpacing(elements, reader, basis.letterSpacing))
      return null
    return engineDefaults.trackingBudget
  }

  private layoutFor(draft: Draft, target: number): RenderedLayout {
    const { expansion, scale, tracking, under } = draft.measurement
    const fits =
      expansion && scale
        ? fitLines(draft.lines, target, expansion, scale)
        : null
    return {
      lines: draft.lines,
      target,
      fits,
      letterfit: tracking
        ? {
            lines: trackLines(draft.lines, target, tracking, fits),
            inherited: under.letterSpacing,
          }
        : null,
    }
  }

  private layoutOptions(measurement: Measurement, indent: number) {
    const { hangs, flex } = measurement
    return {
      policy: this.policy,
      ...(hangs ? { hangs } : {}),
      ...(flex ? { flex } : {}),
      ...(indent === 0 ? {} : { indent }),
      ...(this.lastLineMinWidth > 0
        ? { lastLineMinWidth: this.lastLineMinWidth }
        : {}),
    }
  }

  private verify(
    element: HTMLElement,
    lines: readonly Line[],
    expectedWidth: number,
  ): FailureReason | null {
    const style = styleOf(element)

    if (
      Math.abs(contentWidth(element, style) - expectedWidth) >
      engineDefaults.widthEpsilon
    ) {
      return "unstable-width"
    }
    if (!Number.isFinite(resolvedLineHeight(style))) {
      return "line-height-unresolved"
    }
    return layoutMismatch(element, lines.length, hangSlack(lines))
      ? "layout-mismatch"
      : null
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
      this.remembered.set(composition.element, reason)
    }
    results.set(composition, {
      element: composition.element,
      status: "failed",
      reason,
      cause,
    })
  }

  private disown(element: HTMLElement) {
    element.removeAttribute(TYPESET_ATTRIBUTE)
    this.live.delete(element)
  }

  private restoreElement(element: HTMLElement) {
    const measurement = this.measurements.get(element)
    if (!measurement) {
      this.live.delete(element)
      return
    }
    if (measurement.text !== authoredText(element)) {
      this.measurements.delete(element)
      this.disown(element)
      return
    }
    restoreAuthored(
      element,
      measurement.authored,
      this.preservedImageAttributes,
    )
    this.live.delete(element)
  }

  private metricsFor(
    style: CSSStyleDeclaration,
    locale: string,
    document: Document,
  ) {
    const font = computedFont(style)
    const letterSpacing = cssPixels(style.letterSpacing)
    const key = `${locale}|${letterSpacing}|${variantKey(style)}|${font}`
    const cached = this.metrics.get(key)
    if (cached) return cached
    const metrics = metricsForStyle(document, style, font, letterSpacing)
    if (metrics) this.metrics.set(key, metrics)
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
    const extracted = extractBlock(element, reader, this.maximumCharacters)
    if (!extracted.ok) return { ok: false, reason: extracted.reason }

    configureLocale(basis.locale)
    let unmodellable: ComposeReason | null = null

    const metricsFor = (run: InlineRun): FontMetrics | null => {
      const runStyle = reader(run.sourceElement)
      const metrics = unmodellableProperty(runStyle)
        ? null
        : this.metricsFor(runStyle, basis.locale, element.ownerDocument)
      if (!metrics) unmodellable ??= "unmeasurable"
      return metrics
    }

    const text = authoredText(element)
    const authored = captureAuthored(element)
    const scaleFor = this.expandsWith(element, reader, basis)
    const track = this.tracksWith(extracted.block, reader, basis)
    const compiled = compileBlock({
      block: extracted.block,
      metricsFor,
      baseFont: basis.font,
      atomWidth: (run: InlineRun) => outerWidth(run.sourceElement, reader),
      locale: basis.locale,
      protrude: this.protrudes(element),
      ...(track ? { track } : {}),
      policy: this.policy,
      glue: this.glue,
      ...(this.hyphenate ? { hyphenate: this.hyphenate } : {}),
      ...(scaleFor ? { scaleFor } : {}),
    })
    if (unmodellable) return { ok: false, reason: unmodellable }
    if (!compiled.ok) return { ok: false, reason: compiled.reason }

    return {
      ok: true,
      measurement: {
        block: extracted.block,
        items: compiled.items,
        hangs: compiled.hangs,
        expansion: compiled.expansion,
        tracking: compiled.tracking,
        flex: compiled.flex,
        scale: compiled.scale,
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
