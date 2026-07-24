export const defaultLayoutPolicy = {
  wordSpacing: {
    stretch: 0.5,
    shrink: -0.35,
  },
  fit: {
    overflowTolerance: 0.75,
    maximumTrackingRatio: 0.05,
    minimumTrackingPx: 0.12,
  },
  optimizer: {
    badnessMultiplier: 1_000,
    looseLineBase: 5_000,
    looseLineExcessMultiplier: 10_000,
    tightBase: 3_000,
    tightExcessMultiplier: 10_000,
    hyphen: 50,
    consecutiveHyphenMultiplier: 300,
    fitnessJump: 500,
    trackingMultiplier: 20_000,
  },
} as const
