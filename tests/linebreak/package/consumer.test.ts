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

test("the packed package works for Node, TypeScript, and browser consumers", async () => {
  run("bun", ["run", "build"])

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "linebreak-package-"))

  try {
    const [packed] = JSON.parse(
      run("npm", [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        temporaryDirectory,
        "--cache",
        join(temporaryDirectory, "npm-cache"),
      ]),
    ) as Array<{ filename?: string }>
    if (!packed?.filename) {
      throw new Error("npm pack did not report a tarball filename")
    }

    const tarball = join(temporaryDirectory, packed.filename)
    const entries = run("tar", ["-tf", tarball]).trim().split("\n").sort()
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

    const packedManifest = JSON.parse(
      run("tar", ["-xOf", tarball, "package/package.json"]),
    ) as { exports: Record<string, { default?: string } | string> }
    for (const target of Object.values(packedManifest.exports)) {
      const file = typeof target === "string" ? target : target.default
      if (!file || file.endsWith("package.json")) continue
      expect(entries).toContain(`package/${file.replace(/^\.\//, "")}`)
    }

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
    const subpaths = Object.keys(manifest.exports)
    for (const required of [
      ".",
      "./layout",
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
      expect(Object.keys(target)[0], `${subpath} lists types first`).toBe(
        "types",
      )
      expect(Object.keys(target).at(-1), `${subpath} lists default last`).toBe(
        "default",
      )
    }

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
      join(consumer, "consumer.ts"),
      `import { createLinebreaker, type Composition, type Outcome } from "@enscribe/linebreak"
import { createTypesetter } from "@enscribe/linebreak/auto"
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"
import "@enscribe/linebreak/styles.css"

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
