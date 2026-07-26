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
  exports?: {
    "."?: { import?: string; types?: string }
    "./styles.css"?: { default?: string; types?: string }
  }
  license?: string
  name?: string
  private?: boolean
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
    expect(entries).toEqual(
      [
        "package/LICENSE",
        "package/README.md",
        "package/dist/index.d.ts",
        "package/dist/index.js",
        "package/dist/styles.css",
        "package/dist/styles.css.d.ts",
        "package/package.json",
      ].sort(),
    )

    const unpacked = join(temporaryDirectory, "unpacked")
    await mkdir(unpacked)
    run("tar", ["-xf", tarball, "-C", unpacked])
    const installedPackage = join(unpacked, "package")
    const manifest = JSON.parse(
      await readFile(join(installedPackage, "package.json"), "utf8"),
    ) as PackedPackageManifest
    expect(manifest).toMatchObject({
      name: "@enscribe/linebreak",
      version: "0.1.0",
      license: "MIT",
      private: true,
      dependencies: {
        "@chenglou/pretext": "0.0.8",
        hyphen: "1.14.1",
      },
    })
    expect(manifest.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./styles.css": {
        types: "./dist/styles.css.d.ts",
        default: "./dist/styles.css",
      },
    })

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
      `import * as linebreak from "@enscribe/linebreak"
if (typeof linebreak.createLinebreaker !== "function") throw new Error("missing createLinebreaker")
if (typeof linebreak.cleanCopiedLinebreaks !== "function") throw new Error("missing cleanCopiedLinebreaks")
`,
    )
    run("node", [join(consumer, "runtime.mjs")], { cwd: consumer })

    await writeFile(
      join(consumer, "consumer.ts"),
      `import { createLinebreaker, type LinebreakPlan } from "@enscribe/linebreak"
import "@enscribe/linebreak/styles.css"
declare const paragraph: HTMLElement
const linebreaker = createLinebreaker({ locale: "en-US" })
const plan: LinebreakPlan = linebreaker.plan(paragraph)
linebreaker.commit(plan)
linebreaker.destroy()
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
