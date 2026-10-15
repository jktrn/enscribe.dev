import type { Composition } from "../types"
import type { Line, PreparedParagraph } from "../layout/breaker"
import type { Flex } from "../layout/flex"
import type { StretchScale } from "../text/stretch"
import type { ExtractedBlock } from "../dom/extract"
import type { AuthoredContent } from "../dom/restore"
import type { WrittenLines } from "../dom/render"

export type MeasurementBasis = {
  readonly locale: string
  readonly font: string
  readonly letterSpacing: number
  readonly variant: string
}

export type Measurement = {
  readonly block: ExtractedBlock
  readonly prepared: PreparedParagraph
  readonly breakRuns?: ReadonlyMap<number, number>
  readonly expansion: {
    readonly flex: Flex
    readonly scale: StretchScale
  } | null
  readonly tracking: Flex | null
  readonly authored: AuthoredContent
  readonly under: MeasurementBasis
}

export type Draft = {
  readonly measurement: Measurement
  readonly width: number
  readonly indent: number
  lines: readonly Line[]
  reduction: number
  round: number
  written?: WrittenLines
}

export type RenderJob = {
  readonly composition: Composition
  readonly draft: Draft
}
export type WrittenJob = RenderJob & {
  readonly draft: Draft & { written: WrittenLines }
}
