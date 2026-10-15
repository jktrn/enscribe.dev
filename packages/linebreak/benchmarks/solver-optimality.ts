import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { type Item, breakParagraphOnce } from "../src/layout"
import { breakParagraphOnce as baselineOnce } from "./vendor/baseline/src/layout"
import { breakParagraph as justifBreak } from "./vendor/justif/src/core/breaker"
import { defaultBreakOptions } from "./vendor/justif/src/core/types"
import { benchmarkRoot, packageRoot, prepare } from "./prepare"
import { provenance, sourceHash } from "./provenance"
import { scoreBreaks, solverFixture, type SolverCorpus } from "./solver-data"

type Score = ReturnType<typeof scoreBreaks>
type Plan = { breaks: readonly number[]; score: Score }
type Optima = { continuous: Plan | null; integer: Plan | null; joint: Plan[] }

const geometric = (score: Score) => score.invalidBreaks === 0 &&
  score.crossedForcedBreaks === 0 && score.nonfiniteLines === 0
const continuous = (score: Score) => geometric(score) &&
  score.infeasibleLines === 0 && Number.isFinite(score.demerits)
const integer = (score: Score) => geometric(score) &&
  score.integerInfeasibleLines === 0 && Number.isFinite(score.integerDemerits)
const dominates = (left: Score, right: Score) =>
  left.demerits <= right.demerits && left.integerDemerits <= right.integerDemerits &&
  (left.demerits < right.demerits || left.integerDemerits < right.integerDemerits)

const record = (optima: Optima, plan: Plan) => {
  if (continuous(plan.score) && (!optima.continuous ||
    plan.score.demerits < optima.continuous.score.demerits)) optima.continuous = plan
  if (integer(plan.score) && (!optima.integer ||
    plan.score.integerDemerits < optima.integer.score.integerDemerits)) optima.integer = plan
  if (!continuous(plan.score) || !integer(plan.score)) return
  if (optima.joint.some(({ score }) => dominates(score, plan.score) ||
    (score.demerits === plan.score.demerits && score.integerDemerits === plan.score.integerDemerits))) return
  optima.joint = optima.joint.filter(({ score }) => !dominates(plan.score, score))
  optima.joint.push(plan)
}

const endpoint = (items: readonly Item[], index: number) => {
  const item = items[index]!
  return item.kind === "glue" ? items[index - 1]?.kind === "box" :
    (item.kind === "penalty" || item.kind === "discretionary") && item.penalty < 10000
}
const forced = (item: Item) =>
  (item.kind === "penalty" || item.kind === "discretionary") && item.penalty <= -10000

/**
 * Enumerate legal, potentially feasible prefixes without engine costs or pruning.
 * Zero visits none; it is complete only when no legal endpoint needs inspection.
 */
export const enumerateOptima = (
  items: readonly Item[], width: number, tolerance: number, maximumPrefixes = 500_000,
) => {
  if (!Number.isInteger(maximumPrefixes) || maximumPrefixes < 0)
    throw new RangeError("maximumPrefixes must be a finite nonnegative integer")
  const optima: Optima = { continuous: null, integer: null, joint: [] }
  let prefixes = 0
  let completePlans = 0
  let complete = true
  const visit = (breaks: readonly number[], from: number) => {
    for (let end = from; end < items.length; end += 1) {
      if (!endpoint(items, end)) continue
      if (prefixes >= maximumPrefixes) { complete = false; return }
      prefixes += 1
      const next = [...breaks, end]
      const score = scoreBreaks(items, next, width, tolerance)
      if (continuous(score) || integer(score)) {
        if (score.terminal) { completePlans += 1; record(optima, { breaks: next, score }) }
        else visit(next, end + 1)
      }
      if (!complete || forced(items[end]!)) return
    }
  }
  visit([], 0)
  return { complete, prefixes, completePlans, optima }
}

export const regret = (score: Score, result: ReturnType<typeof enumerateOptima>) => {
  if (!result.complete || !score.terminal) return null
  const { optima } = result
  return {
    continuous: continuous(score) && optima.continuous
      ? score.demerits - optima.continuous.score.demerits : null,
    integer: integer(score) && optima.integer
      ? score.integerDemerits - optima.integer.score.integerDemerits : null,
    jointlyFeasible: continuous(score) && integer(score),
    pareto: continuous(score) && integer(score)
      ? !optima.joint.some((plan) => dominates(plan.score, score)) : null,
  }
}

const evaluate = (words: number, width: number, seed: number, corpus: SolverCorpus,
  selection: "fixed-matrix" | "discovered-tradeoff" = "fixed-matrix") => {
  const fixture = solverFixture(words, seed, corpus)
  const tolerance = corpus === "original" ? 200 : 800
  const optimum = enumerateOptima(fixture.linebreak, width, tolerance)
  const candidate = breakParagraphOnce(fixture.linebreak, width, { tolerance })
  const baseline = baselineOnce(fixture.linebreak, width, { tolerance })
  const comparator = justifBreak(fixture.prepared, width,
    { ...defaultBreakOptions, pretolerance: -1, tolerance, emergencyStretch: 0 })
  const inspect = (breaks: readonly number[], accepted: boolean) => {
    const score = scoreBreaks(fixture.linebreak, breaks, width, tolerance)
    return { accepted, breaks, score, regret: accepted ? regret(score, optimum) : null }
  }
  const engines = {
    linebreak: inspect(candidate.ok ? candidate.lines.map((line) => line.end) : [], candidate.ok),
    baseline: inspect(baseline.ok ? baseline.lines.map((line) => line.end) : [], baseline.ok),
    justif: inspect(comparator.breakpoints, comparator.pass === 2),
  }
  const jointlyFeasible = engines.linebreak.regret?.jointlyFeasible && engines.justif.regret?.jointlyFeasible
  const thirdPlanBeatsBoth = !optimum.complete || !jointlyFeasible ? null :
    optimum.optima.joint.some(({ score }) =>
      dominates(score, engines.linebreak.score) && dominates(score, engines.justif.score))
  return { words, width, seed, corpus, selection, tolerance, items: fixture.linebreak,
    optimum, engines, thirdPlanBeatsBoth }
}

const markdown = (results: ReturnType<typeof evaluate>[]) => [
  "# Exhaustive small-paragraph objective check", "",
  "This untimed diagnostic enumerates legal break plans independently of all three solvers. It reports continuous and TeX-integer objective regret, each over its own tolerance-feasible domain. A separate Pareto frontier uses plans feasible under both conventions. Regret zero means the selected plan attains this scorer's optimum; it is not a visual-quality verdict. Costs use the existing independent primitive-item binary64 scorer, not engine-reported costs or exact-real arithmetic.", "",
  "Every partial plan that remains feasible under either convention is visited. Forced endpoints cannot be crossed. A 500,000-prefix limit bounds each case; a truncated case retains observations but receives no optimum or Pareto ranking. Terminal-plan counts, selected plans, optimum/frontier representatives and primitive items remain in JSON; the complete list of terminal plans is not retained. These moderate fixtures cover the adapters' shared boxes, glue, zero-post-width discretionaries and mandatory penalties; the scorer is not a general rich-text geometry oracle.", "",
  "The fixed 144-case matrix uses four predetermined seeds, four corpora, three sizes and three widths. Two separately labeled tradeoff fixtures were discovered afterward by scanning elastic 18-word paragraphs at180px for seeds0–999; both discovered frontiers are included. Those selected cases demonstrate a possibility, not its frequency in ordinary typography.", "",
  "| Selection | Corpus | Words | Width | Seed | Complete | Terminal plans | Joint frontier | Engine | Continuous regret | Integer regret | Pareto | Third plan dominates both |",
  "| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | --- | --- |",
  ...results.flatMap((result) => Object.entries(result.engines).map(([name, engine]) =>
    `| ${result.selection} | ${result.corpus} | ${result.words} | ${result.width} | ${result.seed} | ${result.optimum.complete} | ${result.optimum.completePlans} | ${result.optimum.optima.joint.length} | ${name} | ${engine.regret?.continuous ?? "n/a"} | ${engine.regret?.integer ?? "n/a"} | ${engine.regret?.pareto ?? "n/a"} | ${result.thirdPlanBeatsBoth ?? "n/a"} |`)), "",
].join("\n")

if (import.meta.main) {
  prepare()
  const metadata = provenance(20260904)
  const results: ReturnType<typeof evaluate>[] = []
  for (const seed of [20260904, 7721, 1981, 42])
    for (const corpus of ["original", "elastic", "forced", "discretionary"] as const)
      for (const words of [6, 10, 18])
        for (const width of [60, 120, 180]) results.push(evaluate(words, width, seed, corpus))
  for (const seed of [230, 707]) results.push(evaluate(18, 180, seed, "elastic", "discovered-tradeoff"))
  if (metadata.candidateSourceHash !== sourceHash(join(packageRoot, "src")))
    throw new Error("Sources changed during exhaustive comparison")
  const output = resolve(process.env.LINEBREAK_BENCH_OUTPUT ?? join(benchmarkRoot, "results"))
  mkdirSync(output, { recursive: true })
  const name = `solver-optimality-${metadata.timestamp.replace(/[:.]/gu, "-")}`
  writeFileSync(join(output, `${name}.json`), JSON.stringify({ metadata, results }, null, 2))
  writeFileSync(join(output, `${name}.md`), markdown(results))
  console.log(`Exhaustively checked ${results.length} cases: ${join(output, `${name}.md`)}`)
}
