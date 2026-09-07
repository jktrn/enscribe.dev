import type { ComposeReason } from "../reasons"
import type { CompiledBlock, CompiledRun } from "./block"
import type { Hyphenator } from "../text/source"
import type { FontMetrics } from "../text/segments"
import type { BreakSequence } from "./compile-breaks"
import type { Item } from "./items"
import type { GlueElasticity, LayoutPolicy } from "./policy"
import type { Flex } from "./flex"
import type { Hangs } from "./protrusion"
import type { StretchScale } from "../text/stretch"

export type RunEdges = { leading: number; trailing: number }

export type CompileContext = {
  block: CompiledBlock
  metricsFor(run: Extract<CompiledRun, { kind: "text" }>): FontMetrics | null
  baseFont: string

  atomWidth?(run: CompiledRun): number
  locale: string

  isCode?(run: CompiledRun): boolean
  edgesFor?(run: CompiledRun): RunEdges

  hyphenate?: Hyphenator
  protrude?: boolean
  scaleFor?(run: Extract<CompiledRun, { kind: "text" }>): StretchScale | null
  track?: number
  policy?: LayoutPolicy
  glue?: GlueElasticity
}

export type CompiledExpansion =
  | { expansion: Flex; scale: StretchScale }
  | { expansion: null; scale: null }

export type CompileResult =
  | ({
      ok: true
      items: Item[]
      breakRuns?: ReadonlyMap<number, number>
      hangs: Hangs | null
      tracking: Flex | null
      flex: Flex | null
    } & CompiledExpansion)
  | { ok: false; reason: ComposeReason }

export type Credits = {
  readonly startOf: Map<number, number>
  readonly endOf: Map<number, number>
}

export class PendingEdge {
  private owed = 0
  private readonly folded: Set<number> | null

  constructor(folded: Set<number> | null) {
    this.folded = folded
  }

  onto(items: Item[], width: number) {
    if (width === 0) return
    const last = items.at(-1)
    if (last?.kind === "box") {
      items[items.length - 1] = { ...last, width: last.width + width }
      this.folded?.add(items.length - 1)
      return
    }
    this.owed += width
  }

  defer(width: number) {
    this.owed += width
  }

  take() {
    const owed = this.owed
    this.owed = 0
    return owed
  }
}

export type Emit = {
  readonly items: Item[]
  readonly pending: PendingEdge
  readonly folded: Set<number> | null
  atomEnd?: number
  space?: true
  sequence?: BreakSequence
}

export type Settings = {
  readonly policy: LayoutPolicy
  readonly elasticity: GlueElasticity
}
