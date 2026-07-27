import {
  breakParagraphWithFallback,
  type Line,
  prefixSums,
  type Sums,
} from "./layout/breaker"
import { compileBlock } from "./layout/compile"
import {
  createDiagnosticEmitter,
  type Diagnostic,
  type EmitDiagnostic,
} from "./diagnostics"
import {
  type ExtractedBlock,
  extractBlock,
  type InlineRun,
  outerWidth,
} from "./dom/extract"
import type { Item } from "./layout/items"
import {
  configureLocale,
  createFontMetrics,
  type FontMetrics,
} from "./text/measure"
import { policy } from "./policy"
import { LINE_SELECTOR, renderLines } from "./dom/render"
import {
  type AuthoredContent,
  captureAuthored,
  restoreAuthored,
} from "./dom/restore"
import {
  computedFont,
  createStyleReader,
  cssPixels,
  unmodellableProperty,
} from "./dom/style"
import type {
  LinebreakPlan,
  LinebreakResult,
  Linebreaker,
  LinebreakerOptions,
} from "./types"

type Measurement = {
  block: ExtractedBlock
  items: Item[]
  sums: Sums
  authored: AuthoredContent

  under: MeasurementBasis
}

type MeasurementBasis = {
  locale: string
  font: string
  letterSpacing: number
}

const sameBasis = (a: MeasurementBasis, b: MeasurementBasis) =>
  a.locale === b.locale &&
  a.font === b.font &&
  a.letterSpacing === b.letterSpacing

type ReadyPlan = {
  state: "ready"
  element: HTMLElement
  measurement: Measurement
  lines: readonly Line[]
  width: number
}

type NativePlan = {
  state: "native"
  element: HTMLElement
  reason: Diagnostic["kind"]
}

type PlanRecord = ReadyPlan | NativePlan

type Attempt = {
  readonly handle: LinebreakPlan
  readonly plan: ReadyPlan
  readonly width: number
  reduction: number
  lines: readonly Line[]
  round: number
}

const contentWidth = (element: HTMLElement, style: CSSStyleDeclaration) =>
  element.clientWidth -
  cssPixels(style.paddingInlineStart) -
  cssPixels(style.paddingInlineEnd)

const contentHeight = (element: HTMLElement, style: CSSStyleDeclaration) =>
  element.clientHeight -
  cssPixels(style.paddingTop) -
  cssPixels(style.paddingBottom)

const anyLineWrapped = (element: HTMLElement) => {
  const range = document.createRange()
  for (const line of element.querySelectorAll<HTMLElement>(LINE_SELECTOR)) {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    let bandBottom = Number.NEGATIVE_INFINITY
    let rows = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width === 0) continue

        if (rect.top >= bandBottom - 2) rows += 1
        bandBottom = Math.max(bandBottom, rect.bottom)
      }
      if (rows > 1) return true
    }
  }
  return false
}

const resolvedLineHeight = (style: CSSStyleDeclaration) => {
  const value = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(value)) return value

  const fontSize = Number.parseFloat(style.fontSize)
  return Number.isFinite(fontSize) ? fontSize * 1.2 : Number.NaN
}

class BrowserLinebreaker implements Linebreaker {
  private readonly minimumWidth: number
  private readonly defaultLocale: string
  private readonly preservedImageAttributes: readonly string[]
  private readonly hyphenate: boolean
  private readonly emit: EmitDiagnostic
  private readonly measurements = new Map<HTMLElement, Measurement>()
  private readonly metrics = new Map<string, FontMetrics>()
  private readonly plans = new WeakMap<LinebreakPlan, PlanRecord>()
  private destroyed = false

  constructor(options: LinebreakerOptions) {
    this.minimumWidth = options.minimumWidth ?? 0
    this.defaultLocale =
      options.locale || document.documentElement.lang || "en-US"
    this.preservedImageAttributes = options.preserveImageAttributes ?? []
    this.hyphenate = options.hyphenate ?? policy.hyphenate
    this.emit = createDiagnosticEmitter(options.onDiagnostic)
  }

  plan(element: HTMLElement): LinebreakPlan {
    const handle: LinebreakPlan = { element }
    if (this.destroyed) {
      this.plans.set(handle, {
        state: "native",
        element,
        reason: "render-failed",
      })
      return handle
    }

    const style = getComputedStyle(element)
    if (style.direction !== "ltr") {
      return this.decline(handle, {
        kind: "unsupported-direction",
        element,
        direction: style.direction,
      })
    }

    const width = contentWidth(element, style)
    if (width < this.minimumWidth) {
      return this.decline(handle, {
        kind: "insufficient-width",
        element,
        width,
        minimum: this.minimumWidth,
      })
    }

    const locale =
      element.closest<HTMLElement>("[lang]")?.getAttribute("lang") ??
      this.defaultLocale

    const basis: MeasurementBasis = {
      locale,
      font: computedFont(style),
      letterSpacing: cssPixels(style.letterSpacing),
    }

    let measurement = this.measurements.get(element)
    if (measurement && !sameBasis(measurement.under, basis)) {
      this.restoreElement(element)
      this.measurements.delete(element)
      measurement = undefined
    }
    if (!measurement) {
      const built = this.measure(element, style, basis)
      if (!built.ok) return this.decline(handle, built.diagnostic)
      measurement = built.measurement
      this.measurements.set(element, measurement)
    }

    const solved = breakParagraphWithFallback(
      measurement.items,
      width - policy.fit.safetyMarginPx,
      measurement.sums,
    )
    if (!solved.ok) {
      return this.decline(handle, {
        kind: "no-feasible-breaking",
        element,
        width,
      })
    }

    if (solved.lines.length < 2) {
      return this.decline(handle, { kind: "single-line", element })
    }

    this.plans.set(handle, {
      state: "ready",
      element,
      measurement,
      lines: solved.lines,
      width,
    })
    return handle
  }

  commit(plan: LinebreakPlan): LinebreakResult
  commit(plans: Iterable<LinebreakPlan>): LinebreakResult[]
  commit(
    input: LinebreakPlan | Iterable<LinebreakPlan>,
  ): LinebreakResult | LinebreakResult[] {
    const single = !isIterable(input)
    const handles = single
      ? [input as LinebreakPlan]
      : [...(input as Iterable<LinebreakPlan>)]
    const results = this.commitAll(handles)
    return single ? (results[0] as LinebreakResult) : results
  }

  private commitAll(handles: LinebreakPlan[]): LinebreakResult[] {
    const results = new Map<LinebreakPlan, LinebreakResult>()
    const duplicates = new Map<LinebreakPlan, HTMLElement>()
    const attempts = this.writeAll(handles, results, duplicates)
    this.settle(attempts, results)

    const byElement = new Map<HTMLElement, LinebreakResult>()
    for (const result of results.values()) byElement.set(result.element, result)

    return handles.map((handle) => {
      const own = results.get(handle)
      if (own) return own
      const element = duplicates.get(handle)
      if (element) {
        const shared = byElement.get(element)
        if (shared) return shared
      }
      return {
        element: handle.element,
        state: "native",
        reason: "render-failed",
      }
    })
  }

  private writeAll(
    handles: LinebreakPlan[],
    results: Map<LinebreakPlan, LinebreakResult>,
    duplicates: Map<LinebreakPlan, HTMLElement>,
  ): Attempt[] {
    const seen = new Set<HTMLElement>()
    const ready: Array<{ attempt: Attempt; reuse: boolean }> = []

    for (const handle of handles) {
      const record = this.plans.get(handle)
      this.plans.delete(handle)
      if (record && record.state === "ready" && seen.has(record.element)) {
        duplicates.set(handle, record.element)
        continue
      }
      if (!record || record.state === "native") {
        results.set(handle, {
          element: record?.element ?? handle.element,
          state: "native",
          reason: record?.reason ?? "render-failed",
        })
        continue
      }
      seen.add(record.element)

      if (this.measurements.get(record.element) !== record.measurement) {
        this.emit({ kind: "stale-plan", element: record.element })
        results.set(handle, {
          element: record.element,
          state: "native",
          reason: "stale-plan",
        })
        continue
      }

      const style = getComputedStyle(record.element)
      const width = contentWidth(record.element, style)
      if (width < this.minimumWidth) {
        results.set(handle, {
          element: record.element,
          state: "native",
          reason: "insufficient-width",
        })
        continue
      }

      ready.push({
        attempt: {
          handle,
          plan: record,
          width,
          reduction: 0,
          lines: record.lines,
          round: 0,
        },
        reuse: Math.abs(width - record.width) <= 0.5,
      })
    }

    return ready
      .filter(({ attempt, reuse }) => this.write(attempt, results, reuse))
      .map(({ attempt }) => attempt)
  }

  private write(
    attempt: Attempt,
    results: Map<LinebreakPlan, LinebreakResult>,
    reuse = false,
  ): boolean {
    const { element } = attempt.plan
    const target = attempt.width - policy.fit.safetyMarginPx - attempt.reduction

    if (!reuse) {
      const solved = breakParagraphWithFallback(
        attempt.plan.measurement.items,
        target,
        attempt.plan.measurement.sums,
      )
      if (!solved.ok) {
        this.revert(
          attempt,
          { kind: "no-feasible-breaking", element, width: target },
          results,
        )
        return false
      }
      attempt.lines = solved.lines
    }

    try {
      const written = renderLines(
        element,
        attempt.plan.measurement.block,
        attempt.lines,
        target,
        this.preservedImageAttributes,
      )
      if (!written) throw new Error("line content could not be rebuilt")
      return true
    } catch (cause) {
      this.revert(attempt, { kind: "render-failed", element, cause }, results)
      return false
    }
  }

  private settle(
    attempts: Attempt[],
    results: Map<LinebreakPlan, LinebreakResult>,
  ) {
    let pending = attempts
    while (pending.length > 0) {
      const retry: Attempt[] = []
      const failed: Array<{ attempt: Attempt; diagnostic: Diagnostic }> = []

      for (const attempt of pending) {
        const diagnostic = this.verify(attempt)
        if (!diagnostic) {
          results.set(attempt.handle, {
            element: attempt.plan.element,
            state: "typeset",
            lineCount: attempt.lines.length,
          })
        } else if (
          diagnostic.kind === "line-wrapped" &&
          attempt.round < policy.fit.rewrapAttempts
        ) {
          attempt.round += 1
          attempt.reduction =
            attempt.width *
            policy.fit.rewrapReduction *
            3 ** (attempt.round - 1)
          retry.push(attempt)
        } else {
          failed.push({ attempt, diagnostic })
        }
      }

      for (const { attempt, diagnostic } of failed) {
        this.revert(attempt, diagnostic, results)
      }

      pending = retry.filter((attempt) => this.write(attempt, results))
    }
  }

  private verify(attempt: Attempt): Diagnostic | null {
    const { element } = attempt.plan
    const style = getComputedStyle(element)
    const lineHeight = resolvedLineHeight(style)
    if (!Number.isFinite(lineHeight)) {
      return {
        kind: "line-height-unresolved",
        element,
        value: style.lineHeight,
      }
    }

    const height = contentHeight(element, style)
    if (height <= (attempt.lines.length + 0.5) * lineHeight) return null
    if (!anyLineWrapped(element)) return null
    return {
      kind: "line-wrapped",
      element,
      expectedLines: attempt.lines.length,
      renderedHeight: height,
      lineHeight,
    }
  }

  typeset(element: HTMLElement): LinebreakResult
  typeset(elements: Iterable<HTMLElement>): LinebreakResult[]
  typeset(
    input: HTMLElement | Iterable<HTMLElement>,
  ): LinebreakResult | LinebreakResult[] {
    if (!isIterable(input)) return this.commit(this.plan(input))
    return this.commit([...input].map((element) => this.plan(element)))
  }

  restore(input: HTMLElement | Iterable<HTMLElement>) {
    const elements = isIterable(input) ? input : [input]
    for (const element of elements) this.restoreElement(element)
  }

  invalidate(input?: HTMLElement | Iterable<HTMLElement>) {
    const elements = input
      ? isIterable(input)
        ? input
        : [input]
      : [...this.measurements.keys()]
    for (const element of elements) {
      this.restoreElement(element)
      this.measurements.delete(element)
    }

    if (input === undefined) this.metrics.clear()
  }

  readMetrics() {
    return {
      cachedParagraphs: this.measurements.size,
      cachedTypographies: this.metrics.size,
    }
  }

  destroy() {
    if (this.destroyed) return
    for (const element of this.measurements.keys()) this.restoreElement(element)
    this.measurements.clear()
    this.metrics.clear()
    this.destroyed = true
  }

  private revert(
    attempt: Attempt,
    diagnostic: Diagnostic,
    results: Map<LinebreakPlan, LinebreakResult>,
  ) {
    const { element } = attempt.plan
    this.emit(diagnostic)
    this.restoreElement(element)
    results.set(attempt.handle, {
      element,
      state: "native",
      reason: diagnostic.kind,
    })
  }

  private decline(
    handle: LinebreakPlan,
    diagnostic: Diagnostic,
  ): LinebreakPlan {
    this.emit(diagnostic)
    this.plans.set(handle, {
      state: "native",
      element: handle.element,
      reason: diagnostic.kind,
    })
    return handle
  }

  private restoreElement(element: HTMLElement) {
    const measurement = this.measurements.get(element)
    if (!measurement) return
    restoreAuthored(
      element,
      measurement.authored,
      this.preservedImageAttributes,
    )
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
    | { ok: false; diagnostic: Diagnostic } {
    const styleOf = createStyleReader(element, style)
    const extracted = extractBlock(element, styleOf)
    if (!extracted.ok) return { ok: false, diagnostic: extracted.diagnostic }

    configureLocale(basis.locale)
    let unmodellable: Diagnostic | null = null

    const metricsFor = (run: InlineRun): FontMetrics | null => {
      const runStyle = styleOf(run.sourceElement)
      const property = unmodellableProperty(runStyle)
      if (property) {
        unmodellable ??= {
          kind: "measurement-unavailable",
          element,
          node: run.sourceElement,
          property,
        }
        return null
      }
      return this.metricsFor(
        computedFont(runStyle),
        cssPixels(runStyle.letterSpacing),
        basis.locale,
      )
    }

    const atomWidth = (run: InlineRun) => outerWidth(run.sourceElement, styleOf)

    const authored = captureAuthored(element)
    const compiled = compileBlock({
      block: extracted.block,
      metricsFor,
      atomWidth,
      locale: basis.locale,
      hyphenate: this.hyphenate,
    })
    if (unmodellable) return { ok: false, diagnostic: unmodellable }
    if (!compiled.ok) return { ok: false, diagnostic: compiled.diagnostic }

    return {
      ok: true,
      measurement: {
        block: extracted.block,
        items: compiled.items,
        sums: prefixSums(compiled.items),
        authored,
        under: basis,
      },
    }
  }
}

const isIterable = <Value>(
  value: Value | Iterable<Value>,
): value is Iterable<Value> =>
  typeof (value as Iterable<Value>)?.[Symbol.iterator] === "function"

export const createLinebreaker = (
  options: LinebreakerOptions = {},
): Linebreaker => new BrowserLinebreaker(options)
