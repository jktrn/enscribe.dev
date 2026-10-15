import type { Corrections } from "../numeric/range"
import type { NumericDiagnostics, SumState } from "../numeric/sum"
import type { Flex } from "../flex"
import type { LayoutPolicy } from "../policy"
import type { Hangs } from "../protrusion"

export type BreakKind = "space" | "hyphen" | "forced" | "none" | "end"

export type Line = {
  readonly start: number
  readonly end: number
  readonly sourceStart: number
  readonly sourceEnd: number
  readonly naturalWidth: number
  readonly spaceCount: number
  readonly stretch: number
  readonly shrink: number
  readonly adjustmentRatio: number
  readonly breakKind: BreakKind
  readonly hangStart: number
  readonly hangEnd: number
}

export type LayoutPass = "pretolerance" | "tolerance" | "emergency" | "forced"

export type LayoutResult =
  | {
      readonly ok: true
      readonly lines: readonly Line[]
      readonly pass: LayoutPass
      readonly demerits: number
    }
  | { readonly ok: false; readonly reason: "empty" | "infeasible" }

export type LayoutOptions = {
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number | "auto"
  readonly hangs?: Hangs
  readonly flex?: Flex
  readonly indent?: number
  readonly lastLineMinWidth?: number
  readonly diagnostics?: LayoutDiagnostics
}

export type PassOptions = {
  readonly tolerance: number
  readonly policy?: Partial<LayoutPolicy>
  readonly emergencyStretch?: number
  readonly force?: boolean
  readonly hangs?: Hangs
  readonly flex?: Flex
  readonly indent?: number
  readonly lastLineMinWidth?: number
  readonly strictEnding?: boolean
  readonly diagnostics?: LayoutDiagnostics
}

export type LayoutDiagnostics = NumericDiagnostics & {
  attemptedPasses?: number
  evaluatedLines: number
  evaluatedBadness?: number
  peakActiveNodes: number
  processedBreakpoints?: number
  pruningChecks?: number
}

/** Numeric opening geometry, owned by the prepared paragraph. */
export type Boundary = {
  readonly position: number
  readonly start: number
  readonly startWidth: number
  readonly startStretch: number
  readonly startShrink: number
  readonly startSpaces: number
  readonly sourceStart: number | null
  readonly hangStart: number
  readonly leading: number
  readonly flagged: boolean
  readonly startLoss: number
}

export type ActiveNode = {
  readonly boundary: Boundary
  readonly leading: number
  readonly fitness: number
  readonly demerits: number
  readonly previous: ActiveNode | null
  readonly ratio: number
}

export type Edge = Boundary & {
  readonly sourceEnd: number
  readonly penaltyCost: number
  readonly forced: boolean
  readonly final: boolean
  readonly width: number
  readonly stretch: number
  readonly shrink: number
  readonly spaces: number
  readonly trailing: number
  readonly hangEnd: number
  readonly breakKind: BreakKind
  minimumWidth: number
  minimumTightWidth: number
  roundingScale: number
  roundingLoss: number
}

export type Geometry = {
  readonly simple?: boolean
  readonly itemCount: number
  readonly corrections: Corrections
  readonly validCapacities: boolean
  readonly boundedCapacities: boolean
  readonly finitePenaltyCosts: boolean
  readonly opening: Boundary
  readonly edges: readonly Edge[]
  readonly autoStretch: number
}

export type Search = {
  readonly simple?: boolean
  readonly itemCount: number
  readonly corrections: Corrections
  readonly validCapacities: boolean
  readonly boundedCapacities: boolean
  readonly demeritBound: number | null
  readonly opening: Boundary
  readonly edges: readonly Edge[]
  readonly target: number
  readonly tolerance: number
  readonly rejectionRatio: number
  readonly emergencyStretch: number
  readonly policy: LayoutPolicy
  readonly rescuing: boolean
  readonly indent: number
  readonly ending: number
  readonly endingStrict: boolean
  readonly diagnostics: LayoutDiagnostics | null
}

export type Measurement = {
  readonly sum: SumState
  natural: number
  ratio: number
  stretch: number
  shrink: number
}
