import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const source = fileURLToPath(
  new URL("../../../packages/linebreak/src", import.meta.url),
)

const SPECIFIER =
  /(?:^|\n)\s*(?:import|export)(?!\s+type\s)\s[^;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g

const fileFor = (from: string, specifier: string) => {
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error(`unresolved specifier ${specifier} from ${from}`)
}

const runtimeGraph = (entry: string) => {
  const seen = new Set<string>()
  const bare = new Set<string>()
  const queue = [resolve(source, entry)]

  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (file.endsWith(".css")) continue

    const text = readFileSync(file, "utf8")
    SPECIFIER.lastIndex = 0
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (specifier.startsWith(".")) queue.push(fileFor(file, specifier))
      else bare.add(specifier)
    }
  }

  return {
    files: [...seen].map((file) => relative(source, file)).sort(),
    packages: [...bare].sort(),
  }
}

const ENTRIES = ["index.ts", "layout.ts", "auto.ts", "attributes.ts"]

describe("entry point import graphs", () => {
  for (const entry of ENTRIES) {
    test(`${entry} loads no hyphenation pattern table`, () => {
      const graph = runtimeGraph(entry)

      expect(graph.files).not.toContain("text/hyphenate.ts")
      expect(
        graph.packages.filter((name) => name.startsWith("hyphen")),
      ).toEqual([])
    })
  }

  test("the hyphenation entry is the only door to the tables", () => {
    const graph = runtimeGraph("hyphenation.ts")

    expect(graph.files).toContain("text/hyphenate.ts")
    expect(graph.packages).toContain("hyphen/en-us")
  })
})
