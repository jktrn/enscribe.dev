import type { ExtractedBlock } from "../dom/extract"
import type { BlockPlan } from "../dom/geometry"
import type { AuthoredSpacing } from "../dom/spacing"
import { optimizeParagraph } from "../layout/knuth-plass"
import type { OptimizedLine, ParagraphLineModel } from "../layout/line-model"
import type { NativeReason } from "../types"

type OptimizableMeasurement = {
  paragraph: ParagraphLineModel
  lastOptimization?: {
    width: number
    lines: OptimizedLine[] | null
  }
}

export type CachedMeasurement = OptimizableMeasurement & {
  extracted: ExtractedBlock
  original: HTMLElement
  authoredSpacing: AuthoredSpacing
  language: string
  metricState: "approximate" | "exact" | "retry-failed"
}

type PlanRecordBase = {
  readonly element: HTMLElement
}

export type ReadyPlanRecord = PlanRecordBase &
  BlockPlan & {
    readonly language: string
    readonly state: "ready"
  }

type NativePlanRecord = PlanRecordBase & {
  readonly state: "native"
  readonly reason: NativeReason
}

export type PlanRecord = ReadyPlanRecord | NativePlanRecord

export const optimizeMeasurement = (
  measurement: OptimizableMeasurement,
  width: number,
  optimize: typeof optimizeParagraph = optimizeParagraph,
) => {
  if (measurement.lastOptimization?.width === width) {
    return measurement.lastOptimization.lines
  }

  const lines = optimize(measurement.paragraph, width)
  measurement.lastOptimization = { width, lines }
  return lines
}

export const isIterable = <Value>(
  value: Value | Iterable<Value>,
): value is Iterable<Value> =>
  typeof (value as Iterable<Value>)[Symbol.iterator] === "function"

export const oneOrMany = <Value>(value: Value | Iterable<Value>): Value[] =>
  isIterable(value) ? [...value] : [value]
