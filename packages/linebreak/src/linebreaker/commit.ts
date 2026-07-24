import { contentWidth } from "../dom/geometry"
import type { LinebreakPlan, LinebreakResult } from "../types"
import type { CachedMeasurement, PlanRecord, ReadyPlanRecord } from "./plan"
import { type RenderPlanContext, tryRenderPlan } from "./render-plan"
import { type RenderedPlan, stabilizeRenderedPlans } from "./stabilize"

type CommitContext = RenderPlanContext & {
  records: WeakMap<LinebreakPlan, PlanRecord>
  minimumWidth: number
  resizeTolerance: number
  measurements: Map<HTMLElement, CachedMeasurement>
  createExactMeasurement: (element: HTMLElement) => CachedMeasurement | null
  resolveLanguage: (element: HTMLElement) => string
  restoreElement: (element: HTMLElement) => void
}

type FinishedCommit = {
  readonly kind: "finished"
  readonly result: LinebreakResult
}

type ReadyCommit = {
  readonly kind: "ready"
  readonly plan: ReadyPlanRecord
}

const finished = (result: LinebreakResult): FinishedCommit => ({
  kind: "finished",
  result,
})

export const commitPlans = (
  handles: LinebreakPlan[],
  context: CommitContext,
): LinebreakResult[] => {
  const restoreAfterValidation = new Set<HTMLElement>()
  const seenElements = new Set<HTMLElement>()
  const validated: Array<FinishedCommit | ReadyCommit> = []

  for (const handle of handles) {
    const plan = context.records.get(handle)
    if (!plan) {
      validated.push(
        finished({
          element: handle.element,
          state: "stale",
        }),
      )
      continue
    }

    context.records.delete(handle)
    if (seenElements.has(plan.element)) {
      validated.push(finished({ element: plan.element, state: "stale" }))
      continue
    }
    seenElements.add(plan.element)

    if (plan.state === "native") {
      restoreAfterValidation.add(plan.element)
      validated.push(
        finished({
          element: plan.element,
          state: "native",
          reason: plan.reason,
        }),
      )
      continue
    }

    try {
      if (context.resolveLanguage(plan.element) !== plan.language) {
        restoreAfterValidation.add(plan.element)
        validated.push(
          finished({
            element: plan.element,
            state: "stale",
            lineCount: plan.lines.length,
          }),
        )
        continue
      }
      const currentWidth = contentWidth(
        plan.element,
        getComputedStyle(plan.element),
      )
      if (Math.abs(currentWidth - plan.width) > context.resizeTolerance) {
        restoreAfterValidation.add(plan.element)
        validated.push(
          finished({
            element: plan.element,
            state: "stale",
            lineCount: plan.lines.length,
          }),
        )
        continue
      }
      validated.push({ kind: "ready", plan })
    } catch (cause) {
      context.report(plan.element, "measure", cause)
      restoreAfterValidation.add(plan.element)
      validated.push(
        finished({
          element: plan.element,
          state: "native",
          reason: "unsupported-content",
        }),
      )
    }
  }

  for (const element of restoreAfterValidation) context.restoreElement(element)

  const rendered: RenderedPlan[] = []
  const committed: Array<FinishedCommit | RenderedPlan> = validated.map(
    (entry) => {
      if (entry.kind === "finished") return entry
      const lineElements = tryRenderPlan(entry.plan, context)
      if (!lineElements) {
        context.restoreElement(entry.plan.element)
        return finished({
          element: entry.plan.element,
          state: "native",
          reason: "render-failed",
        })
      }

      const renderedPlan: RenderedPlan = {
        kind: "rendered",
        lineElements,
        plan: entry.plan,
        status: { state: "unstable" },
      }
      rendered.push(renderedPlan)
      return renderedPlan
    },
  )

  stabilizeRenderedPlans({ ...context, rendered })

  return committed.map((entry) => {
    if (entry.kind === "finished") return entry.result
    const { plan, status } = entry
    switch (status.state) {
      case "native":
        return {
          element: plan.element,
          state: "native",
          reason: status.reason,
        }
      case "unstable":
        return {
          element: plan.element,
          state: "stale",
          lineCount: plan.lines.length,
        }
      case "stable":
        return {
          element: plan.element,
          state: "typeset",
          lineCount: plan.lines.length,
        }
    }
  })
}
