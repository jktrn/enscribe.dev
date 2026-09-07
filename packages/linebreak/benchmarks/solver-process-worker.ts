import { readFileSync } from "node:fs"
import { solverItems, scoreBreaks } from "./solver-data"
import type { LayoutResult } from "../src/layout"
import type { ProcessCase } from "./solver-process-cases"

const config = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as ProcessCase
const fixture = solverItems(config.words, config.seed, config.corpus)
const { width, tolerance } = config, layout = config.lane.startsWith("layout")
const preparedLane = config.lane === "solve" || config.lane === "layout-solve"
let call: () => object, run: () => number, breaks: (output: object) => readonly number[]
const consume = (output: object, demerits: number) => {
  Reflect.set(globalThis, "__linebreakBenchmarkOutput", output)
  return demerits
}
if (config.engine === "justif") {
  const { breakParagraph } = await import("./vendor/justif/src/core/breaker")
  const { withSums } = await import("./vendor/justif/src/core/items")
  const { defaultBreakOptions } = await import("./vendor/justif/src/core/types")
  const prepared = preparedLane || config.lane === "full-after-prepare" ? withSums(fixture.justif, fixture.runs) : null
  const options = { ...defaultBreakOptions, pretolerance: layout ? 100 : -1, tolerance,
    emergencyStretch: layout ? "auto" as const : 0 }
  const operation = () => breakParagraph(preparedLane ? prepared! : withSums(fixture.justif, fixture.runs), width, options)
  call = operation
  run = () => { const output = operation(); return consume(output, output.demerits) }
  breaks = output => (output as ReturnType<typeof operation>).breakpoints
} else {
  const module = await import("../src/layout")
  const prepared = preparedLane || config.lane === "full-after-prepare" ? module.prepareParagraph(fixture.linebreak) : null
  const options = { tolerance, policy: { scoring: config.engine } }
  const layoutOptions = { policy: { scoring: config.engine, pretolerance: 100, tolerance } }
  const operation = (): LayoutResult => config.lane === "layout-prepare-solve" ?
    module.prepareParagraph(fixture.linebreak).breakParagraph(width, layoutOptions) : layout ?
    (preparedLane ? prepared!.breakParagraph(width, layoutOptions) : module.breakParagraph(fixture.linebreak, width, layoutOptions)) :
    (preparedLane ? prepared!.breakParagraphOnce(width, options) : module.breakParagraphOnce(fixture.linebreak, width, options))
  call = operation
  run = () => { const output = operation(); return consume(output, output.ok ? output.demerits : 0) }
  breaks = output => { const result = output as LayoutResult; return result.ok ? result.lines.map(line => line.end) : [] }
}
const check = () => {
  const result = call()
  if (JSON.stringify(result) !== JSON.stringify(config.expected)) throw new Error("Complete output changed")
  return { result, score: scoreBreaks(fixture.linebreak, breaks(result), width, tolerance) }
}
const before = check()
let count = config.count, confirmed = 0
const batch = () => {
  let checksum = 0
  const start = performance.now()
  for (let index = 0; index < count; index++) checksum += run()
  const elapsedMs = performance.now() - start
  return { count, checksum, elapsedMs, nsPerOp: elapsedMs * 1e6 / count }
}
const observations = []
for (let attempt = 0; attempt < 20; attempt++) {
  batch(); batch()
  const row = batch(); observations.push(row)
  if (!config.calibrate) {
    if (row.elapsedMs < 20) throw new Error("Recorded batch below 20ms")
    break
  }
  confirmed = row.elapsedMs >= 30 ? confirmed + 1 : 0
  if (confirmed === 2) break
  if (row.elapsedMs < 30) count = Math.max(count + 1, Math.ceil(count * Math.min(10, 45 / Math.max(row.elapsedMs, .001))))
  if (attempt === 19) throw new Error("Calibration did not converge")
}
check()
console.log(JSON.stringify({ config, before, observations, count, recorded: observations.at(-1), pid: process.pid, completedAt: new Date().toISOString() }))
