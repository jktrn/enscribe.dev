export type LayoutPolicy = {
  /** Continuous cubic scoring by default; integer selects TeX-style badness and fitness. */
  readonly scoring?: "continuous" | "integer"
  readonly pretolerance: number
  readonly tolerance: number
  readonly linePenalty: number
  readonly hyphenPenalty: number
  readonly exHyphenPenalty: number
  readonly adjDemerits: number
  readonly doubleHyphenDemerits: number
  readonly finalHyphenDemerits: number
}

export const texDefaults: LayoutPolicy = Object.freeze({
  pretolerance: 100,
  tolerance: 200,
  linePenalty: 10,
  hyphenPenalty: 50,
  exHyphenPenalty: 50,
  adjDemerits: 10_000,
  doubleHyphenDemerits: 10_000,
  finalHyphenDemerits: 5_000,
})

export const webDefaults: LayoutPolicy = Object.freeze({ ...texDefaults })

export const resolvePolicy = (
  overrides?: Partial<LayoutPolicy>,
): LayoutPolicy =>
  overrides ? Object.freeze({ ...webDefaults, ...overrides }) : webDefaults

export const INFINITE_BADNESS = 10_000

export const INFINITE_PENALTY = 10_000

export const EJECT_PENALTY = -10_000

export const INFINITE_STRETCH = 100_000

export type GlueElasticity = {
  readonly stretch: number
  readonly shrink: number
}

export const defaultGlue: GlueElasticity = Object.freeze({
  stretch: 1 / 2,
  shrink: 1 / 3,
})
