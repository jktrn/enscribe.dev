import { readPretextPreparationStats } from "../adapters/pretext"
import { contentWidth } from "../dom/geometry"
import type { ExactTextCache } from "../dom/exact"
import { type MetricSource, measureParagraph } from "../dom/measure"
import { restoreAuthoredContent } from "../dom/restore"
import { readAuthoredSpacing } from "../dom/spacing"
import { createBlockTemplate } from "../dom/template"
import { type OptimizedLine, ParagraphLineModel } from "../layout/line-model"
import type {
  LinebreakError,
  LinebreakMetrics,
  LinebreakPlan,
  LinebreakResult,
  Linebreaker,
  LinebreakerOptions,
  NativeReason,
} from "../types"
import { commitPlans } from "./commit"
import {
  type CachedMeasurement,
  isIterable,
  oneOrMany,
  optimizeMeasurement,
  type PlanRecord,
  type ReadyPlanRecord,
} from "./plan"

class BrowserLinebreaker implements Linebreaker {
  private readonly minimumWidth: number
  private readonly locale: string
  private readonly resizeTolerance: number
  private readonly onError?: (error: LinebreakError) => void
  private readonly preservedImageAttributes: readonly string[]
  private readonly measurements = new Map<HTMLElement, CachedMeasurement>()
  private readonly exactTextWidths: ExactTextCache = new Map()
  private plans = new WeakMap<LinebreakPlan, PlanRecord>()
  private destroyed = false
  private exactRetries = 0

  constructor(options: LinebreakerOptions) {
    this.minimumWidth = options.minimumWidth ?? 0
    this.locale = options.locale || document.documentElement.lang || "en-US"
    this.resizeTolerance = options.resizeTolerance ?? 0.75
    this.onError = options.onError
    this.preservedImageAttributes = options.preserveImageAttributes ?? []
  }

  plan(element: HTMLElement): LinebreakPlan {
    if (this.destroyed) return this.nativePlan(element, "destroyed")

    const language = this.resolveLanguage(element)
    let measurement = this.measurements.get(element)
    if (measurement && measurement.language !== language) {
      this.restoreElement(element)
      this.measurements.delete(element)
      measurement = undefined
    }

    let style: CSSStyleDeclaration
    let width: number
    try {
      style = getComputedStyle(element)
      if (style.direction !== "ltr") {
        return this.nativePlan(element, "unsupported-direction")
      }
      width = contentWidth(element, style)
      if (width < this.minimumWidth) {
        return this.nativePlan(element, "insufficient-width")
      }
    } catch (cause) {
      this.report(element, "measure", cause)
      return this.nativePlan(element, "unsupported-content")
    }

    try {
      if (!measurement) {
        measurement =
          this.createMeasurement(element, style, language) ?? undefined
        if (measurement) this.measurements.set(element, measurement)
      }
    } catch (cause) {
      this.report(element, "measure", cause)
    }
    if (!measurement) return this.nativePlan(element, "unsupported-content")

    let lines: OptimizedLine[] | null
    try {
      lines = optimizeMeasurement(measurement, width)
    } catch (cause) {
      this.report(element, "optimize", cause)
      return this.nativePlan(element, "infeasible")
    }
    if (!lines) return this.nativePlan(element, "infeasible")

    const record: ReadyPlanRecord = {
      element,
      state: "ready",
      extracted: measurement.extracted,
      lines,
      width,
      authoredSpacing: measurement.authoredSpacing,
      language: measurement.language,
    }
    return this.createPlan(record)
  }

  commit(plan: LinebreakPlan): LinebreakResult
  commit(plans: Iterable<LinebreakPlan>): LinebreakResult[]
  commit(
    input: LinebreakPlan | Iterable<LinebreakPlan>,
  ): LinebreakResult | LinebreakResult[] {
    const single = !isIterable(input)
    const plans = oneOrMany(input)
    const results = commitPlans(plans, {
      records: this.plans,
      minimumWidth: this.minimumWidth,
      resizeTolerance: this.resizeTolerance,
      preservedImageAttributes: this.preservedImageAttributes,
      measurements: this.measurements,
      createExactMeasurement: (element) => {
        this.exactRetries += 1
        return this.createMeasurement(
          element,
          getComputedStyle(element),
          this.resolveLanguage(element),
          "dom",
        )
      },
      resolveLanguage: (element) => this.resolveLanguage(element),
      restoreElement: (element) => this.restoreElement(element),
      report: (element, phase, cause) => this.report(element, phase, cause),
    })
    return single ? results[0]! : results
  }

  typeset(element: HTMLElement): LinebreakResult
  typeset(elements: Iterable<HTMLElement>): LinebreakResult[]
  typeset(
    input: HTMLElement | Iterable<HTMLElement>,
  ): LinebreakResult | LinebreakResult[] {
    if (!isIterable(input)) return this.commit(this.plan(input))
    return this.commit(Array.from(input, (element) => this.plan(element)))
  }

  restore(element: HTMLElement): void
  restore(elements: Iterable<HTMLElement>): void
  restore(input: HTMLElement | Iterable<HTMLElement>) {
    const elements = isIterable(input) ? input : [input]
    let started = false
    for (const element of elements) {
      if (!started) {
        this.discardPlans()
        started = true
      }
      this.restoreElement(element)
    }
  }

  invalidate(element: HTMLElement): void
  invalidate(elements: Iterable<HTMLElement>): void
  invalidate(input: HTMLElement | Iterable<HTMLElement>) {
    const elements = isIterable(input) ? input : [input]
    let first = true
    for (const element of elements) {
      if (first) this.discardPlans()
      this.restoreElement(element)
      this.measurements.delete(element)
      if (first) {
        this.exactTextWidths.clear()
        first = false
      }
    }
  }

  readMetrics(): LinebreakMetrics {
    return {
      cachedParagraphs: this.measurements.size,
      exactRetries: this.exactRetries,
      preparation: readPretextPreparationStats(),
    }
  }

  destroy() {
    if (this.destroyed) return
    this.discardPlans()
    for (const element of this.measurements.keys()) this.restoreElement(element)
    this.measurements.clear()
    this.exactTextWidths.clear()
    this.destroyed = true
  }

  private restoreElement(element: HTMLElement) {
    const original = this.measurements.get(element)?.original
    if (!original || element.dataset.kpJustified === undefined) return
    restoreAuthoredContent(element, original, this.preservedImageAttributes)
  }

  private nativePlan(
    element: HTMLElement,
    reason: NativeReason,
  ): LinebreakPlan {
    return this.createPlan({
      element,
      state: "native",
      reason,
    })
  }

  private createPlan(record: PlanRecord): LinebreakPlan {
    const plan: LinebreakPlan = { element: record.element }
    this.plans.set(plan, record)
    return plan
  }

  private discardPlans() {
    this.plans = new WeakMap()
  }

  private createMeasurement(
    element: HTMLElement,
    style: CSSStyleDeclaration,
    language: string,
    metricSource: MetricSource = "canvas",
  ): CachedMeasurement | null {
    const paragraph = measureParagraph(
      element,
      style,
      language,
      metricSource,
      this.exactTextWidths,
    )
    if (!paragraph) return null
    const { extracted, prepared } = paragraph

    const template = createBlockTemplate(element, extracted)
    const measurement: CachedMeasurement = {
      extracted: template.extracted,
      paragraph: new ParagraphLineModel(prepared),
      original: template.root,
      authoredSpacing: readAuthoredSpacing(style),
      language,
      metricState: metricSource === "dom" ? "exact" : "approximate",
    }
    return measurement
  }

  private resolveLanguage(element: HTMLElement) {
    const language = element
      .closest<HTMLElement>("[lang]")
      ?.getAttribute("lang")
    return language ?? this.locale
  }

  private report(
    element: HTMLElement,
    phase: LinebreakError["phase"],
    cause: unknown,
  ) {
    try {
      this.onError?.({ element, phase, cause })
    } catch {}
  }
}

export const createLinebreaker = (
  options: LinebreakerOptions = {},
): Linebreaker => new BrowserLinebreaker(options)
