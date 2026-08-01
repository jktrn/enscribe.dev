/**
 * Tunable constants for the Knuth-Plass line search.
 *
 * Names and defaults follow TeX82 (`plain.tex`) rather than the 1981 paper.
 * Where the two disagree — most consequentially in the demerits formula for
 * positive penalties — this package implements TeX82. See `lineDemerits`.
 */
export type LayoutPolicy = {
  /** TeX `\pretolerance`, as badness. Threshold for the first pass. */
  readonly pretolerance: number
  /** TeX `\tolerance`, as badness. Threshold for passes 2-4. */
  readonly tolerance: number
  /** TeX `\linepenalty`. Added to every line's badness before squaring. */
  readonly linePenalty: number
  /** TeX `\hyphenpenalty`. Charged at a discretionary that draws a hyphen. */
  readonly hyphenPenalty: number
  /** TeX `\exhyphenpenalty`. Charged at an existing hyphen or dash. */
  readonly exHyphenPenalty: number
  /** TeX `\adjdemerits`. Also the width of the fitness-pruning window. */
  readonly adjDemerits: number
  /** TeX `\doublehyphendemerits`. Two consecutive flagged breaks. */
  readonly doubleHyphenDemerits: number
  /** TeX `\finalhyphendemerits`. A flagged break on the penultimate line. */
  readonly finalHyphenDemerits: number
}

/** `plain.tex`, verbatim. Frozen so it can back a configuration UI. */
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

/**
 * What the DOM tier ships. Currently identical to {@link texDefaults}; kept
 * separate so the web defaults can diverge without a silent semver break.
 */
export const webDefaults: LayoutPolicy = Object.freeze({ ...texDefaults })

export const resolvePolicy = (
  overrides?: Partial<LayoutPolicy>,
): LayoutPolicy =>
  overrides ? Object.freeze({ ...webDefaults, ...overrides }) : webDefaults

/** TeX `inf_penalty`. A penalty at or above this forbids a break. */
export const INFINITE_PENALTY = 10_000

/** TeX `eject_penalty`. A penalty at or below this forces a break. */
export const EJECT_PENALTY = -10_000

/** Stand-in for TeX's `1fil`. Large enough to dominate any real glue. */
export const INFINITE_STRETCH = 100_000

/**
 * Interword elasticity as a fraction of the measured space width.
 *
 * Computer Modern's interword glue is `0.333em plus 0.167em minus 0.111em`,
 * i.e. stretch 1/2 and shrink 1/3 of the natural space.
 */
export type GlueElasticity = {
  readonly stretch: number
  readonly shrink: number
}

export const defaultGlue: GlueElasticity = Object.freeze({
  stretch: 1 / 2,
  shrink: 1 / 3,
})

/** Hyphenation minima, following TeX's `\lefthyphenmin` / `\righthyphenmin`. */
export const hyphenationLimits = Object.freeze({
  minimumWordLength: 5,
  left: 2,
  right: 3,
})
