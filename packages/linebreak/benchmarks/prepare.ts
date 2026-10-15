import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import comparator from "./comparator.json" with { type: "json" }

export const benchmarkRoot = dirname(fileURLToPath(import.meta.url))
export const packageRoot = resolve(benchmarkRoot, "..")
export const repositoryRoot = resolve(packageRoot, "../..")
export const cacheRoot = join(homedir(), ".linebreak-bench")
export const justifRoot = join(cacheRoot, `justif-${comparator.commit}`)
export const baselineRoot = join(cacheRoot, `linebreak-${comparator.baselineCommit}`)

const git = (args: string[], cwd: string) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim()

const link = (source: string, destination: string) => {
  if (existsSync(destination)) return
  symlinkSync(source, destination, "dir")
}

const prepareComparator = () => {
  if (!existsSync(justifRoot)) {
    mkdirSync(justifRoot, { recursive: true })
    git(["init", "--quiet"], justifRoot)
    git(["remote", "add", "origin", comparator.repository], justifRoot)
    git(["fetch", "--quiet", "--depth", "1", "origin", comparator.commit], justifRoot)
    git(["checkout", "--quiet", "--detach", "FETCH_HEAD"], justifRoot)
  }
  if (git(["rev-parse", "HEAD"], justifRoot) !== comparator.commit) {
    throw new Error("Comparator cache has the wrong commit")
  }
  if (git(["status", "--porcelain", "--untracked-files=no"], justifRoot) !== "") {
    throw new Error("Comparator cache has modified tracked files")
  }
}

const prepareBaseline = () => {
  const paths = git(["ls-tree", "-r", "--name-only", comparator.baselineCommit, "packages/linebreak/src"], repositoryRoot).split("\n")
  for (const path of paths) {
    const relative = path.replace("packages/linebreak/", "")
    const destination = join(baselineRoot, relative)
    const expected = execFileSync("git", ["show", `${comparator.baselineCommit}:${path}`], { cwd: repositoryRoot })
    if (existsSync(destination)) {
      if (!readFileSync(destination).equals(expected)) throw new Error(`Baseline cache modified: ${relative}`)
      continue
    }
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, expected)
  }
  link(join(packageRoot, "node_modules"), join(baselineRoot, "node_modules"))
}

export const prepare = () => {
  mkdirSync(cacheRoot, { recursive: true })
  prepareComparator()
  prepareBaseline()
  const vendor = join(benchmarkRoot, "vendor")
  mkdirSync(vendor, { recursive: true })
  link(justifRoot, join(vendor, "justif"))
  link(baselineRoot, join(vendor, "baseline"))
}

if (import.meta.main) {
  prepare()
  console.log(`Pinned justif ${comparator.tag} (${comparator.commit}); baseline ${comparator.baselineCommit}`)
}
