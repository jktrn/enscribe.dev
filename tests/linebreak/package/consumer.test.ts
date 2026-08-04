import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const packageDirectory = fileURLToPath(
  new URL("../../../packages/linebreak", import.meta.url),
)
const packageModules = join(packageDirectory, "node_modules")
const testModules = fileURLToPath(new URL("../node_modules", import.meta.url))

interface PackedPackageManifest {
  dependencies?: Record<string, string>
  exports: Record<string, string | Record<string, string>>
  license?: string
  name?: string
  private?: boolean
  publishConfig?: { access?: string }
  keywords?: string[]
  version?: string
}

const run = (
  command: string,
  arguments_: string[],
  options: { cwd?: string } = {},
) =>
  execFileSync(command, arguments_, {
    cwd: packageDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  })

const packTarball = (into: string) => {
  const [packed] = JSON.parse(
    run("npm", [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      into,
      "--cache",
      join(into, "npm-cache"),
    ]),
  ) as Array<{ filename?: string }>
  if (!packed?.filename) {
    throw new Error("npm pack did not report a tarball filename")
  }
  return join(into, packed.filename)
}

const expectOnlyPublishedFiles = (entries: readonly string[]) => {
  for (const required of [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
  ]) {
    expect(entries).toContain(required)
  }
  for (const entry of entries) {
    expect(entry).toMatch(
      /^package\/(dist\/|LICENSE$|README\.md$|package\.json$)/,
    )
  }
}

const expectEveryExportPacked = (
  entries: readonly string[],
  exports: Record<string, { default?: string } | string>,
) => {
  for (const target of Object.values(exports)) {
    const file = typeof target === "string" ? target : target.default
    if (!file || file.endsWith("package.json")) continue
    expect(entries).toContain(`package/${file.replace(/^\.\//, "")}`)
  }
}

const expectExportsInOrder = (manifest: PackedPackageManifest) => {
  const subpaths = Object.keys(manifest.exports)
  for (const required of [
    ".",
    "./layout",
    "./text",
    "./auto",
    "./attributes",
    "./hyphenation",
    "./styles.css",
    "./package.json",
  ]) {
    expect(subpaths).toContain(required)
  }
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (typeof target === "string") continue
    expect(Object.keys(target)[0], `${subpath} lists types first`).toBe("types")
    expect(Object.keys(target).at(-1), `${subpath} lists default last`).toBe(
      "default",
    )
  }
}

test("the packed package works for Node, TypeScript, and browser consumers", async () => {
  run("bun", ["run", "build"])

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "linebreak-package-"))

  try {
    const tarball = packTarball(temporaryDirectory)
    const entries = run("tar", ["-tf", tarball]).trim().split("\n").sort()
    expectOnlyPublishedFiles(entries)

    const packedManifest = JSON.parse(
      run("tar", ["-xOf", tarball, "package/package.json"]),
    ) as { exports: Record<string, { default?: string } | string> }
    expectEveryExportPacked(entries, packedManifest.exports)

    const unpacked = join(temporaryDirectory, "unpacked")
    await mkdir(unpacked)
    run("tar", ["-xf", tarball, "-C", unpacked])
    const installedPackage = join(unpacked, "package")
    const manifest = JSON.parse(
      await readFile(join(installedPackage, "package.json"), "utf8"),
    ) as PackedPackageManifest
    expect(manifest).toMatchObject({
      name: "@enscribe/linebreak",
      license: "MIT",
      dependencies: {
        "@chenglou/pretext": "0.0.8",
        hyphen: "1.14.1",
      },
    })
    expect(manifest.private).toBeUndefined()
    expect(manifest.publishConfig?.access).toBe("public")
    expect(manifest.keywords?.length).toBeGreaterThan(0)
    expectExportsInOrder(manifest)

    const installedModules = join(unpacked, "node_modules")
    await mkdir(join(installedModules, "@chenglou"), { recursive: true })
    await symlink(
      join(packageModules, "@chenglou", "pretext"),
      join(installedModules, "@chenglou", "pretext"),
      "dir",
    )
    await symlink(
      join(packageModules, "hyphen"),
      join(installedModules, "hyphen"),
      "dir",
    )

    const consumer = join(temporaryDirectory, "consumer")
    const consumerModules = join(consumer, "node_modules")
    await mkdir(join(consumerModules, "@enscribe"), { recursive: true })
    await symlink(
      installedPackage,
      join(consumerModules, "@enscribe", "linebreak"),
      "dir",
    )

    await writeFile(
      join(consumer, "runtime.mjs"),
      `import { box, breakParagraph, glue, paragraphEnd } from "@enscribe/linebreak/layout"
import { ATTRIBUTES } from "@enscribe/linebreak/attributes"

const items = [box(180), glue(8, 4, 2.67), box(180), glue(8, 4, 2.67), box(180), ...paragraphEnd()]
const result = breakParagraph(items, 400)
if (!result.ok) throw new Error("expected a solution")
if (result.lines.length !== 2) throw new Error("expected two lines, got " + result.lines.length)
if (result.lines.at(-1).breakKind !== "end") throw new Error("last line must report end")
if (!["pretolerance", "tolerance", "emergency", "forced"].includes(result.pass)) {
  throw new Error("unexpected pass: " + result.pass)
}
if (ATTRIBUTES.atom !== "data-linebreak-atom") throw new Error("attribute contract moved")
`,
    )
    run("node", [join(consumer, "runtime.mjs")], { cwd: consumer })

    await writeFile(
      join(consumer, "headless.mjs"),
      `import { breakParagraph } from "@enscribe/linebreak/layout"
import { compileText, createMetrics } from "@enscribe/linebreak/text"

if (typeof document !== "undefined") throw new Error("this process has a document")
if (typeof window !== "undefined") throw new Error("this process has a window")

const text = "Knuth and Plass break a paragraph by considering it whole."
const metrics = createMetrics({ measure: (piece) => piece.length * 7.5 })
const compiled = compileText(text, metrics, { protrude: true, track: 0.03 })
if (!compiled.ok) throw new Error("compileText declined: " + compiled.reason)
if (!compiled.hangs || !compiled.tracking) throw new Error("expected hangs and tracking")

const result = breakParagraph(compiled.items, 200, { hangs: compiled.hangs, flex: compiled.flex })
if (!result.ok) throw new Error("expected a solution")
if (result.lines.length < 2) throw new Error("expected more than one line")

let rebuilt = ""
for (const [index, line] of result.lines.entries()) {
  if (index > 0 && result.lines[index - 1].breakKind === "space") rebuilt += " "
  rebuilt += text.slice(line.sourceStart, line.sourceEnd)
}
if (rebuilt !== text) throw new Error("lines do not reconstruct the paragraph: " + rebuilt)
`,
    )
    run("node", [join(consumer, "headless.mjs")], { cwd: consumer })
    run("bun", [join(consumer, "headless.mjs")], { cwd: consumer })

    await writeFile(
      join(consumer, "consumer.ts"),
      `import { createLinebreaker, type Composition, type Outcome } from "@enscribe/linebreak"
import { createTypesetter } from "@enscribe/linebreak/auto"
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"
import {
  compileText,
  createMetrics,
  segmentText,
  type Advance,
  type CompileResult,
  type FontMetrics,
  type TextSegment,
} from "@enscribe/linebreak/text"
import "@enscribe/linebreak/styles.css"

const advance: Advance = (piece) => piece.length * 7.5
const segments: TextSegment[] = segmentText("headless prose")
const headless: FontMetrics = createMetrics({ measure: advance, segment: () => segments })
const compiled: CompileResult = compileText("headless prose", headless, { track: 0.03 })
if (compiled.ok) console.log(compiled.items.length, compiled.tracking)

declare const paragraph: HTMLElement

const linebreaker = createLinebreaker({ locale: "en-US", hyphenate: englishHyphenator })
const compositions: readonly Composition[] = linebreaker.compose([paragraph])
const outcomes: readonly Outcome[] = linebreaker.apply(compositions)
for (const outcome of outcomes) {
  if (outcome.status === "typeset") console.log(outcome.lines)
  else console.log(outcome.reason)
}
linebreaker.dispose()

const typesetter = createTypesetter({ roots: "[data-linebreak-root]" })
void typesetter.start().then(() => typesetter.settled)
typesetter.dispose()
`,
    )
    await writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["DOM", "ES2022"],
          strict: true,
          noEmit: true,
          noUncheckedSideEffectImports: true,
          skipLibCheck: true,
        },
        include: ["consumer.ts"],
      }),
    )
    run(
      "node",
      [
        join(testModules, "typescript", "bin", "tsc"),
        "-p",
        join(consumer, "tsconfig.json"),
      ],
      { cwd: consumer },
    )
    run(
      "bun",
      [
        "build",
        join(consumer, "consumer.ts"),
        "--target",
        "browser",
        "--outdir",
        join(consumer, "browser-build"),
      ],
      { cwd: consumer },
    )
    const browserOutput = await readdir(join(consumer, "browser-build"))
    expect(browserOutput.some((file) => file.endsWith(".css"))).toBe(true)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}, 30_000)
