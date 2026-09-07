import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { arch, cpus, platform, release, totalmem } from "node:os"
import { join, relative } from "node:path"
import comparator from "./comparator.json" with { type: "json" }
import { baselineRoot, benchmarkRoot, justifRoot, packageRoot, repositoryRoot } from "./prepare"

const filesOf = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? filesOf(join(root, entry.name)) : [join(root, entry.name)],
).sort()

export const sourceHash = (root: string) => {
  const hash = createHash("sha256")
  for (const file of filesOf(root)) {
    hash.update(relative(root, file))
    hash.update("\0")
    hash.update(readFileSync(file))
  }
  return hash.digest("hex")
}

const git = (...args: string[]) => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim()

export const provenance = (seed: number) => ({
  timestamp: new Date().toISOString(), seed,
  instrumentRevision: 3,
  instrumentHash: createHash("sha256").update(readdirSync(benchmarkRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => `${entry.name}\0${readFileSync(join(benchmarkRoot, entry.name), "utf8")}`).join("\0")).digest("hex"),
  candidateCommit: git("rev-parse", "HEAD"), candidateDirty: git("status", "--porcelain", "--", "packages/linebreak/src") !== "",
  candidateSourceHash: sourceHash(join(packageRoot, "src")),
  baselineCommit: comparator.baselineCommit, baselineSourceHash: sourceHash(join(baselineRoot, "src")),
  comparator, comparatorSourceHash: sourceHash(join(justifRoot, "src")),
  runtime: { bun: Bun.version, node: process.version, os: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model ?? "unreported", logicalCpus: cpus().length, memoryBytes: totalmem() },
})
