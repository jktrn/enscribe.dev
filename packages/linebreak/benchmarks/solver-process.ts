import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { gzipSync, gunzipSync } from "node:zlib"
import { arch, cpus, platform, release } from "node:os"
import { prepare, packageRoot, repositoryRoot, benchmarkRoot } from "./prepare"
import { processReport, type ProcessObservation } from "./solver-process-report"
import type { ProcessCase } from "./solver-process-cases"
import comparator from "./comparator.json" with { type: "json" }

const value = (name: string) => process.argv.find(argument => argument.startsWith(`${name}=`))?.slice(name.length + 1)
const seed = Number(value("--seed") ?? 20260904)
if (!Number.isSafeInteger(seed) || seed < 0) throw new Error("Seed must be a nonnegative safe integer")
const quick = process.argv.includes("--quick"), onlyCase = value("--case"), onlyLane = value("--lane")
prepare()
const { processCases } = await import("./solver-process-cases")
const cases = processCases(seed).filter(configs =>
  (onlyCase === undefined || configs[0]!.case === Number(onlyCase)) &&
  (onlyLane === undefined || configs[0]!.lane === onlyLane))
if (!cases.length) throw new Error("No matching case")
const output = resolve(value("--output") ?? join(benchmarkRoot, "results"), `process-${new Date().toISOString().replace(/[:.]/g, "-")}`)
mkdirSync(output, { recursive: true })
const save = (name: string, data: object) => writeFileSync(join(output, name), JSON.stringify(data))
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)])
const sourceFiles = () => [
  ...files(join(packageRoot, "src")), ...files(join(benchmarkRoot, "vendor/justif/src")),
  ...["solver-process.ts", "solver-process-cases.ts", "solver-process-worker.ts", "solver-process-report.ts",
    "solver-data.ts", "random.ts", "statistics.ts", "prepare.ts", "comparator.json"].map(name => join(benchmarkRoot, name)),
  join(packageRoot, "package.json"), join(repositoryRoot, "package.json"), join(repositoryRoot, "bun.lock"),
  join(benchmarkRoot, "vendor/justif/LICENSE"),
].sort()
const hashes = () => Object.fromEntries(sourceFiles().map(path => [relative(repositoryRoot, path), digest(readFileSync(path))]))
const sourceHashes = hashes()
const archive = Object.fromEntries(sourceFiles().map(path => [relative(repositoryRoot, path), readFileSync(path).toString("base64")]))
const compressed = gzipSync(JSON.stringify(archive))
writeFileSync(join(output, "sources.json.gz"), compressed)
const readback = JSON.parse(gunzipSync(readFileSync(join(output, "sources.json.gz"))).toString()) as Record<string, string>
const recovered = Object.fromEntries(Object.entries(readback).map(([path, data]) => [path, digest(Buffer.from(data, "base64"))]))
if (JSON.stringify(recovered) !== JSON.stringify(sourceHashes)) throw new Error("Source archive readback failed")
save("source-hashes.json", sourceHashes)
save("cases.json", cases)
const casesHash = digest(readFileSync(join(output, "cases.json")))
const metadata = { timestamp: new Date().toISOString(), seed, quick, cases: cases.length, comparator,
  candidateCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
  candidateDirty: execFileSync("git", ["status", "--porcelain", "--", "packages/linebreak/src"], { cwd: repositoryRoot, encoding: "utf8" }).trim() !== "",
  runtime: { bun: Bun.version, node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model },
  sourceArchiveHash: digest(compressed), exactSourceReadback: true, casesHash }
save("metadata.json", metadata)
const stable = () => {
  try { return JSON.stringify(hashes()) === JSON.stringify(sourceHashes) && digest(readFileSync(join(output, "cases.json"))) === casesHash }
  catch { return false }
}
const launch = (config: ProcessCase, key: string) => {
  const request = join(output, `${key}.request.json`)
  save(`${key}.request.json`, config)
  const result = spawnSync(process.execPath, [join(benchmarkRoot, "solver-process-worker.ts"), request], { encoding: "utf8", maxBuffer: 20_000_000 })
  writeFileSync(join(output, `${key}.stdout`), result.stdout ?? "")
  writeFileSync(join(output, `${key}.stderr`), result.stderr ?? "")
  if (result.status !== 0) throw new Error(`${key} failed: ${result.error?.message ?? result.stderr}`)
  return JSON.parse(result.stdout) as ProcessObservation & { count: number }
}
const counts: ProcessCase[][] = [], observations: ProcessObservation[] = [], failures: string[] = []
const orders = quick ? [[0, 1, 2], [2, 1, 0]] : [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
let complete = false, calibrationHash = ""
let calibrationInputs: Record<string, string> = {}
const stableCalibration = () => Object.entries(calibrationInputs).every(([name, hash]) => digest(readFileSync(join(output, name))) === hash)
try {
  for (const configs of cases) {
    counts.push(configs.map(config => ({ ...config,
      count: launch(config, `calibrate-${config.case}-${config.engine}`).count * 2, calibrate: false })))
    save("counts.json", counts)
    console.log(`Calibrated ${counts.length}/${cases.length}`)
  }
  if (!stable()) throw new Error("Inputs changed during calibration")
  calibrationHash = digest(readFileSync(join(output, "counts.json")))
  const calibrationFiles = readdirSync(output).filter(name => name.startsWith("calibrate-") || name === "counts.json").sort()
  calibrationInputs = Object.fromEntries(calibrationFiles.map(name => [name, digest(readFileSync(join(output, name)))]))
  const calibrationArchive = Object.fromEntries(calibrationFiles.map(name => [name, readFileSync(join(output, name)).toString("base64")]))
  writeFileSync(join(output, "calibration.json.gz"), gzipSync(JSON.stringify(calibrationArchive)))
  const calibrationReadback = JSON.parse(gunzipSync(readFileSync(join(output, "calibration.json.gz"))).toString()) as Record<string, string>
  const calibrationRecovered = Object.fromEntries(Object.entries(calibrationReadback).map(([name, bytes]) => [name, digest(Buffer.from(bytes, "base64"))]))
  if (JSON.stringify(calibrationInputs) !== JSON.stringify(calibrationRecovered)) throw new Error("Calibration archive readback failed")
  save("calibration-inputs.json", calibrationInputs)
  save("calibration-hash.json", { calibrationHash, exactReadback: true })
  for (const [index, configs] of counts.entries()) {
    for (const [repeat, order] of orders.entries()) for (const [position, engine] of order.entries()) {
      const config = configs[engine]!
      observations.push({ ...launch(config, `measure-${config.case}-${repeat}-${position}`), case: config.case, repeat, position })
    }
    save("timing.json", { metadata, observations, complete: false })
    console.log(`Measured ${index + 1}/${cases.length}`)
  }
  if (!stable() || !stableCalibration()) throw new Error("Inputs changed during measurement")
  complete = true
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  save("timing.json", { metadata, observations, complete, failures, calibrationHash, stableInputs: stable() })
  save("summary.json", { metadata, complete, failures, ...processReport(cases, observations, orders.length) })
  console.log(`Results: ${join(output, "summary.json")}`)
}
