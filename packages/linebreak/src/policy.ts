export const policy = {
  glue: {
    stretch: 1 / 2,
    shrink: 1 / 2,
  },
  fit: {
    tolerance: 1,
    relaxedTolerance: 1.26,
    emergencyStretchSpaces: 14,
    safetyMarginPx: 0.5,
    rewrapAttempts: 3,
    rewrapReduction: 0.01,
  },
  demerits: {
    linePenalty: 10,
    consecutiveFlagged: 10_000,
    fitnessJump: 10_000,
  },
  penalty: {
    hyphen: 50,
  },
  hyphenate: false,
  limits: {
    maximumCharacters: 3_000,
    minimumHyphenatedWordLength: 5,
  },
} as const

export const INFINITE_STRETCH = 100_000

export const FORBIDDEN_PENALTY = 1_000

export const FORCED_PENALTY = -1_000
