import type { LinebreakerOptions } from "./types"

export const engineDefaults = Object.freeze({
  minimumWidth: 240,
  safetyMargin: 0.5,
  widthEpsilon: 0.5,
  retries: 3,
  retryReduction: 0.01,
  maximumCharacters: 3_000,
  expansionBudget: 0.02,
  trackingBudget: 0.03,
  lastLineMinWidth: 0,
})

export const engineLimits = (options: LinebreakerOptions) => ({
  minimumWidth: options.minimumWidth ?? engineDefaults.minimumWidth,
  safetyMargin: options.safetyMargin ?? engineDefaults.safetyMargin,
  maximumRetries: options.retries ?? engineDefaults.retries,
  maximumCharacters:
    options.maximumCharacters ?? engineDefaults.maximumCharacters,
})
