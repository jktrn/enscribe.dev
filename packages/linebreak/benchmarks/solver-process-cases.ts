import { breakParagraph, breakParagraphOnce, prepareParagraph, type LayoutResult } from "../src/layout"
import { solverItems, scoreBreaks, type SolverCorpus } from "./solver-data"
import { breakParagraph as justifBreak } from "./vendor/justif/src/core/breaker"
import { withSums } from "./vendor/justif/src/core/items"
import { defaultBreakOptions } from "./vendor/justif/src/core/types"

export type SolverEngine = "continuous" | "integer" | "justif"
export type SolverLane = "full-direct" | "full-after-prepare" | "solve" | "layout-full" | "layout-solve" | "layout-prepare-solve"
export type ProcessCase = {
  case: number; corpus: SolverCorpus; words: number; width: number; tolerance: number; seed: number
  lane: SolverLane; engine: SolverEngine; expected: object
  score: ReturnType<typeof scoreBreaks>; count: number; calibrate: boolean
}
export const solverEngines: SolverEngine[] = ["continuous", "integer", "justif"]
const endpoints = (result: LayoutResult) => result.ok ? result.lines.map(line => line.end) : []

export const processCases = (seed: number): ProcessCase[][] => {
  const cases: ProcessCase[][] = []
  for (const corpus of ["original", "elastic", "forced", "discretionary"] as const) {
    for (const words of [32, 128, 512, 2048]) for (const width of [240, 480, 720]) {
      const fixture = solverItems(words, seed, corpus), tolerance = corpus === "original" ? 200 : 800
      const lanes: SolverLane[] = ["full-direct", "full-after-prepare", "solve"]
      if (width === 480) lanes.push("layout-full", "layout-solve")
      for (const lane of lanes) {
        const layout = lane.startsWith("layout")
        cases.push(solverEngines.map(engine => {
          let expected: object, breaks: readonly number[]
          if (engine === "justif") {
            const result = justifBreak(withSums(fixture.justif, fixture.runs), width, {
              ...defaultBreakOptions, pretolerance: layout ? 100 : -1, tolerance,
              emergencyStretch: layout ? "auto" : 0,
            })
            expected = result; breaks = result.breakpoints
          } else {
            const policy = { scoring: engine, pretolerance: 100, tolerance }
            const result = layout ? breakParagraph(fixture.linebreak, width, { policy }) :
              breakParagraphOnce(fixture.linebreak, width, { tolerance, policy: { scoring: engine } })
            expected = result; breaks = endpoints(result)
          }
          return { case: cases.length, corpus, words, width, tolerance, seed, lane, engine, expected,
            score: scoreBreaks(fixture.linebreak, breaks, width, tolerance), count: 1, calibrate: true }
        }))
      }
    }
  }
  // Append the new metric so historical case numbers remain stable.
  for (const configs of [...cases]) {
    if (configs[0]!.lane !== "layout-full") continue
    cases.push(configs.map(config => {
      const { engine, words, corpus, width, tolerance } = config
      if (engine === "justif") return { ...config, case: cases.length, lane: "layout-prepare-solve" as const }
      const fixture = solverItems(words, seed, corpus)
      const expected = prepareParagraph(fixture.linebreak).breakParagraph(width, {
        policy: { scoring: engine, pretolerance: 100, tolerance },
      })
      return { ...config, case: cases.length, lane: "layout-prepare-solve" as const, expected,
        score: scoreBreaks(fixture.linebreak, endpoints(expected), width, tolerance) }
    }))
  }
  return cases
}
