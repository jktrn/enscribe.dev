import { INFINITE_BADNESS } from "../policy"
import { linesFrom } from "./result"
import { runSearch } from "./search"
import { rejectionRatio } from "./cost"
import { searchFor } from "./problem"
import type { Geometry, LayoutOptions, LayoutResult, Search } from "./types"

const resetDiagnostics = (search: Search) => {
  const { diagnostics } = search
  if (!diagnostics) return
  diagnostics.evaluatedLines = 0
  diagnostics.evaluatedBadness = 0
  diagnostics.peakActiveNodes = 0
  diagnostics.processedBreakpoints = 0
  diagnostics.pruningChecks = 0
  diagnostics.compensatedRangeEvaluations = 0
  diagnostics.exactRangeEvaluations = 0
}

export const solve = (search: Search): LayoutResult => {
  resetDiagnostics(search)
  if (search.itemCount === 0) return { ok: false, reason: "empty" }
  if (!(search.target > 0) || !Number.isFinite(search.target)) {
    return { ok: false, reason: "infeasible" }
  }
  if (search.diagnostics)
    search.diagnostics.attemptedPasses =
      (search.diagnostics.attemptedPasses as number) + 1
  const final = runSearch(search)
  if (!final?.previous) {
    return { ok: false, reason: "infeasible" }
  }
  return {
    ok: true,
    lines: linesFrom(search, final),
    pass: search.rescuing ? "forced" : "tolerance",
    demerits: final.demerits,
  }
}

const withTolerance = (search: Search, tolerance: number): Search => ({
  ...search,
  tolerance,
  rejectionRatio: rejectionRatio(tolerance, search.policy.scoring),
})

const toleranceRungs = (search: Search): LayoutResult | null => {
  const { policy } = search
  if (policy.pretolerance >= 0) {
    const strict = solve(withTolerance(search, policy.pretolerance))
    if (strict.ok) return { ...strict, pass: "pretolerance" }
  }
  const relaxed = solve(withTolerance(search, policy.tolerance))
  return relaxed.ok ? relaxed : null
}

export const breakWithGeometry = (
  geometry: Geometry,
  measure: number,
  options: LayoutOptions = {},
): LayoutResult => {
  const search = searchFor(geometry, measure, {
    ...options,
    emergencyStretch: 0,
    tolerance: 0,
  })
  if (options.lastLineMinWidth) {
    const rectangle = toleranceRungs({ ...search, endingStrict: true })
    if (rectangle) return rectangle
  }
  const relaxed = toleranceRungs(search)
  if (relaxed) return relaxed
  return finishAfterTolerance(geometry, search, options)
}

export const finishAfterTolerance = (
  geometry: Geometry, search: Search, options: LayoutOptions,
): LayoutResult => {
  const requested = options.emergencyStretch
  const emergencyStretch =
    requested === undefined || requested === "auto"
      ? geometry.autoStretch
      : requested
  const emergencySearch = { ...search, emergencyStretch }
  if (emergencyStretch > 0) {
    const emergency = solve(
      withTolerance(emergencySearch, search.policy.tolerance),
    )
    if (emergency.ok) return { ...emergency, pass: "emergency" }
  }
  return solve({
    ...withTolerance(emergencySearch, INFINITE_BADNESS),
    rescuing: true,
  })
}
