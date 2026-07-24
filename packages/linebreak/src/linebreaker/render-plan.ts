import { renderLines } from "../dom/render"
import type { LinebreakError } from "../types"
import type { ReadyPlanRecord } from "./plan"

export type RenderPlanContext = {
  preservedImageAttributes: readonly string[]
  report: (
    element: HTMLElement,
    phase: LinebreakError["phase"],
    cause: unknown,
  ) => void
}

export const tryRenderPlan = (
  plan: ReadyPlanRecord,
  context: RenderPlanContext,
) => {
  try {
    return renderLines(
      plan.element,
      plan.extracted,
      plan.lines,
      plan.authoredSpacing,
      context.preservedImageAttributes,
    )
  } catch (cause) {
    context.report(plan.element, "render", cause)
    return null
  }
}
