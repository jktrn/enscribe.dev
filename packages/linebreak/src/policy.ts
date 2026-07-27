export const policy = {
  glue: {
    stretch: 1 / 2,
    shrink: 0.6,
  },
  fit: {
    tolerance: 1,
    relaxedTolerance: 2.5,
    safetyMarginPx: 0.5,
    rewrapAttempts: 3,
    rewrapReduction: 0.01,
  },
  demerits: {
    consecutiveFlagged: 3_000,
    fitnessJump: 3_000,
  },
  penalty: {
    hyphen: 50,
  },
  hyphenate: false,
  limits: {
    maximumCharacters: 3_000,
    minimumHyphenatedWordLength: 6,
  },
} as const

export const INFINITE_STRETCH = 100_000

export const FORBIDDEN_PENALTY = 1_000

export const FORCED_PENALTY = -1_000
