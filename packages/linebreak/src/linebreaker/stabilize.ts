import {
  applyLineCorrection,
  correctionsFrom,
  contentWidth,
  measureGeneratedLines,
  measureRenderedLines,
  type RenderedLineMeasurement,
} from "../dom/geometry"
import type { OptimizedLine } from "../layout/line-model"
import type { NativeReason } from "../types"
import {
  type CachedMeasurement,
  optimizeMeasurement,
  type ReadyPlanRecord,
} from "./plan"
import { type RenderPlanContext, tryRenderPlan } from "./render-plan"

const MAX_INTRINSIC_STABILIZATION_PASSES = 2
const MAX_LINE_CORRECTION_PASSES = 2

type RenderStatus =
  | { readonly state: "unstable" }
  | { readonly state: "stable" }
  | { readonly state: "native"; readonly reason: NativeReason }

export type RenderedPlan = {
  readonly kind: "rendered"
  lineElements: readonly HTMLElement[] | null
  readonly plan: ReadyPlanRecord
  status: RenderStatus
}

type StabilizeContext = RenderPlanContext & {
  rendered: RenderedPlan[]
  minimumWidth: number
  resizeTolerance: number
  measurements: Map<HTMLElement, CachedMeasurement>
  createExactMeasurement: (element: HTMLElement) => CachedMeasurement | null
  restoreElement: (element: HTMLElement) => void
}

type MeasuredCandidate = {
  entry: RenderedPlan
  measurement: CachedMeasurement
}

type OptimizedCandidate = MeasuredCandidate & {
  lines: OptimizedLine[]
  width: number
}

type LineMeasurements = Map<RenderedPlan, RenderedLineMeasurement[]>

type PendingCorrection = {
  entry: RenderedPlan
  line: RenderedLineMeasurement
}

const fail = (entry: RenderedPlan, reason: NativeReason) => {
  entry.lineElements = null
  entry.status = { state: "native", reason }
}

const currentLineElements = (entry: RenderedPlan) => {
  if (!entry.lineElements) {
    throw new Error("Rendered paragraph has no current line elements")
  }
  return entry.lineElements
}

const restoreRenderedPlan = (
  entry: RenderedPlan,
  context: StabilizeContext,
) => {
  entry.lineElements = null
  context.restoreElement(entry.plan.element)
}

const rerender = (entry: RenderedPlan, context: RenderPlanContext) => {
  const lineElements = tryRenderPlan(entry.plan, context)
  if (!lineElements) return false
  entry.lineElements = lineElements
  return true
}

const readCurrentWidth = (context: StabilizeContext, entry: RenderedPlan) => {
  try {
    return contentWidth(
      entry.plan.element,
      getComputedStyle(entry.plan.element),
    )
  } catch (cause) {
    context.report(entry.plan.element, "measure", cause)
    fail(entry, "unsupported-content")
    return null
  }
}

const stabilizeWidths = (context: StabilizeContext) => {
  let widthsAreCurrent = false
  const changedPlans = new Set<RenderedPlan>()

  for (let pass = 0; pass < MAX_INTRINSIC_STABILIZATION_PASSES; pass += 1) {
    const plansToRender: RenderedPlan[] = []
    let restoredDuringPass = false

    for (const entry of context.rendered) {
      if (entry.status.state === "native") continue
      const { plan } = entry
      const width = readCurrentWidth(context, entry)
      if (width === null) continue
      if (Math.abs(width - plan.width) <= context.resizeTolerance) {
        entry.status = { state: "stable" }
        continue
      }

      changedPlans.add(entry)
      entry.status = { state: "unstable" }
      if (width < context.minimumWidth) {
        fail(entry, "insufficient-width")
        restoredDuringPass ||= plan.element.dataset.kpJustified !== undefined
        restoreRenderedPlan(entry, context)
        continue
      }

      let lines: OptimizedLine[] | null = null
      try {
        const measurement = context.measurements.get(plan.element)
        if (measurement) lines = optimizeMeasurement(measurement, width)
      } catch (cause) {
        context.report(plan.element, "optimize", cause)
      }
      if (!lines) {
        fail(entry, "infeasible")
        restoredDuringPass ||= plan.element.dataset.kpJustified !== undefined
        restoreRenderedPlan(entry, context)
        continue
      }

      plan.width = width
      plan.lines = lines
      plansToRender.push(entry)
    }

    if (plansToRender.length === 0) {
      widthsAreCurrent = !restoredDuringPass
      break
    }

    for (const entry of plansToRender) {
      if (rerender(entry, context)) continue
      fail(entry, "render-failed")
      restoreRenderedPlan(entry, context)
    }
  }

  if (widthsAreCurrent) return changedPlans
  for (const entry of context.rendered) {
    if (entry.status.state === "native") continue
    const { plan } = entry
    const width = readCurrentWidth(context, entry)
    if (width === null) continue
    if (Math.abs(width - plan.width) <= context.resizeTolerance) {
      entry.status = { state: "stable" }
    } else {
      entry.status = { state: "unstable" }
      changedPlans.add(entry)
    }
  }
  return changedPlans
}

const refreshLineMeasurements = (
  context: StabilizeContext,
  measurements: LineMeasurements,
  changedPlans: Iterable<RenderedPlan>,
) => {
  for (const entry of measurements.keys()) {
    if (entry.status.state !== "stable") measurements.delete(entry)
  }
  for (const entry of changedPlans) {
    if (entry.status.state !== "stable") continue
    try {
      measurements.set(
        entry,
        measureRenderedLines(entry.plan, currentLineElements(entry)),
      )
    } catch (cause) {
      context.report(entry.plan.element, "render", cause)
      fail(entry, "render-failed")
      measurements.delete(entry)
    }
  }
}

const measureStablePlans = (context: StabilizeContext) => {
  const measurements: LineMeasurements = new Map()
  refreshLineMeasurements(context, measurements, context.rendered)
  return measurements
}

const collectExactCandidates = (
  context: StabilizeContext,
  unresolved: Iterable<RenderedPlan>,
) => {
  const candidates: RenderedPlan[] = []
  for (const entry of unresolved) {
    if (entry.status.state !== "stable") continue
    const measurement = context.measurements.get(entry.plan.element)
    if (measurement?.metricState !== "approximate") continue
    measurement.metricState = "retry-failed"
    candidates.push(entry)
  }
  return candidates
}

const measureExactly = (
  candidates: RenderedPlan[],
  context: StabilizeContext,
) => {
  const measured: MeasuredCandidate[] = []
  for (const entry of candidates) {
    try {
      const measurement = context.createExactMeasurement(entry.plan.element)
      if (measurement) {
        context.measurements.set(entry.plan.element, measurement)
        measured.push({ entry, measurement })
      } else fail(entry, "unsupported-content")
    } catch (cause) {
      context.report(entry.plan.element, "measure", cause)
      fail(entry, "unsupported-content")
    }
  }
  return measured
}

const optimizeExactly = (
  candidates: MeasuredCandidate[],
  context: StabilizeContext,
) => {
  const optimized: OptimizedCandidate[] = []
  for (const candidate of candidates) {
    const { entry, measurement } = candidate
    const width = readCurrentWidth(context, entry)
    if (width === null) continue
    if (width < context.minimumWidth) {
      fail(entry, "insufficient-width")
      continue
    }

    let lines: OptimizedLine[] | null = null
    try {
      lines = optimizeMeasurement(measurement, width)
    } catch (cause) {
      context.report(entry.plan.element, "optimize", cause)
    }
    if (lines) optimized.push({ entry, measurement, width, lines })
    else fail(entry, "infeasible")
  }
  return optimized
}

const renderExact = (
  candidates: OptimizedCandidate[],
  context: StabilizeContext,
) => {
  for (const { entry, measurement, width, lines } of candidates) {
    const { plan } = entry
    plan.extracted = measurement.extracted
    plan.authoredSpacing = measurement.authoredSpacing
    plan.width = width
    plan.lines = lines
    if (rerender(entry, context)) {
      entry.status = { state: "unstable" }
    } else {
      fail(entry, "render-failed")
      restoreRenderedPlan(entry, context)
    }
  }
}

const retryWithDomMetrics = (
  context: StabilizeContext,
  unresolved: Iterable<RenderedPlan>,
) => {
  const candidates = collectExactCandidates(context, unresolved)
  if (candidates.length === 0) return candidates

  for (const entry of candidates) restoreRenderedPlan(entry, context)
  const measured = measureExactly(candidates, context)
  const optimized = optimizeExactly(measured, context)
  renderExact(optimized, context)
  return candidates
}

const correctLines = (
  context: StabilizeContext,
  measurements: LineMeasurements,
) => {
  let corrected = false
  let unresolved = new Set<RenderedPlan>()

  for (let pass = 0; pass < MAX_LINE_CORRECTION_PASSES; pass += 1) {
    const corrections: PendingCorrection[] = []
    const changedPlans = new Set<RenderedPlan>()
    for (const [entry, lines] of measurements) {
      const lineCorrections = correctionsFrom(lines)
      if (lineCorrections.length > 0) changedPlans.add(entry)
      for (const correction of lineCorrections) {
        corrections.push({ entry, line: correction })
      }
    }
    if (corrections.length === 0) break
    corrected = true
    unresolved = new Set()
    for (const correction of corrections) {
      if (correction.entry.status.state !== "stable") continue
      try {
        if (!applyLineCorrection(correction.line)) {
          unresolved.add(correction.entry)
        }
      } catch (cause) {
        context.report(correction.entry.plan.element, "render", cause)
        fail(correction.entry, "render-failed")
      }
    }
    if (pass + 1 < MAX_LINE_CORRECTION_PASSES) {
      refreshLineMeasurements(context, measurements, changedPlans)
    }
  }
  return { corrected, unresolved }
}

const validateLineGeometry = (context: StabilizeContext) => {
  for (const entry of context.rendered) {
    if (entry.status.state !== "stable") continue
    try {
      const { plan } = entry
      if (plan.element.scrollWidth > plan.element.clientWidth + 1) {
        fail(entry, "render-failed")
        continue
      }
      const layout = measureGeneratedLines(plan, currentLineElements(entry))
      if (
        layout.hasWrappedLine ||
        layout.visualLineCount !== plan.lines.length
      ) {
        fail(entry, "render-failed")
      }
    } catch (cause) {
      context.report(entry.plan.element, "render", cause)
      fail(entry, "render-failed")
    }
  }
}

const restoreFailedPlans = (
  context: StabilizeContext,
  settlementRequired: boolean,
) => {
  let changedLayout = settlementRequired
  for (const entry of context.rendered) {
    if (entry.status.state === "stable") continue
    changedLayout ||= entry.plan.element.dataset.kpJustified !== undefined
    restoreRenderedPlan(entry, context)
  }
  return changedLayout
}

const settleSurvivingPlans = (
  context: StabilizeContext,
  settlementRequired: boolean,
) => {
  let changedLayout = settlementRequired
  while (changedLayout) {
    changedLayout = false
    for (const entry of context.rendered) {
      if (entry.status.state !== "stable") continue
      const { plan } = entry

      const width = readCurrentWidth(context, entry)
      if (width === null) {
        restoreRenderedPlan(entry, context)
        changedLayout = true
        continue
      }
      if (Math.abs(width - plan.width) <= context.resizeTolerance) continue

      if (width < context.minimumWidth) fail(entry, "insufficient-width")
      else entry.status = { state: "unstable" }
      restoreRenderedPlan(entry, context)
      changedLayout = true
    }
  }
}

export const stabilizeRenderedPlans = (context: StabilizeContext) => {
  let settlementRequired = false

  stabilizeWidths(context)
  const initialCorrection = correctLines(context, measureStablePlans(context))
  settlementRequired = initialCorrection.corrected

  const retried = retryWithDomMetrics(context, initialCorrection.unresolved)
  const retriedSet = new Set(retried)
  for (const entry of initialCorrection.unresolved) {
    if (!retriedSet.has(entry)) fail(entry, "render-failed")
  }

  if (retried.length > 0) {
    const changedPlans = stabilizeWidths(context)
    for (const entry of retried) changedPlans.add(entry)
    const exactMeasurements: LineMeasurements = new Map()
    refreshLineMeasurements(context, exactMeasurements, changedPlans)
    const exactCorrection = correctLines(context, exactMeasurements)
    settlementRequired ||= exactCorrection.corrected
    for (const entry of exactCorrection.unresolved) {
      fail(entry, "render-failed")
    }
  }
  validateLineGeometry(context)

  settlementRequired = restoreFailedPlans(context, settlementRequired)
  settleSurvivingPlans(context, settlementRequired)
}
