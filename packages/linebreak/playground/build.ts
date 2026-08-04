import { existsSync } from "node:fs"
import { mkdir, readdir, rm, symlink } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import type { BunPlugin } from "bun"

const here = dirname(Bun.fileURLToPath(import.meta.url))
const packageRoot = resolve(here, "..")
const repoRoot = resolve(packageRoot, "../..")
const out = join(here, "dist")

const justifRoot = resolve(
  process.env.JUSTIF_PATH ?? join(homedir(), ".linebreak-bench/justif"),
)

if (!existsSync(join(justifRoot, "src/index.ts"))) {
  throw new Error(
    `justif sources not found at ${justifRoot}. Clone justif there or set ` +
      "JUSTIF_PATH to its checkout.",
  )
}

const ALIASES: Record<string, string> = {
  "@enscribe/linebreak": join(packageRoot, "src/index.ts"),
  "@enscribe/linebreak/hyphenation": join(packageRoot, "src/hyphenation.ts"),
  justif: join(justifRoot, "src/index.ts"),
  "justif/hyphenate/en-us": join(justifRoot, "src/hyphenation/en-us.ts"),
}

const alias: BunPlugin = {
  name: "playground-alias",
  setup(build) {
    build.onResolve(
      { filter: /^(@enscribe\/linebreak|justif)(\/.*)?$/ },
      (args) => {
        const target = ALIASES[args.path]
        if (!target) throw new Error(`playground: no alias for ${args.path}`)
        return { path: target }
      },
    )
  },
}

const FONT_SOURCES: Record<string, string> = {
  "MDLorien-Regular.woff2": join(
    repoRoot,
    "src/assets/fonts/MDLorien-Regular.woff2",
  ),
  "MDLorien-Italic.woff2": join(
    repoRoot,
    "src/assets/fonts/MDLorien-Italic.woff2",
  ),
  "IBMPlexSans-Variable.woff2": join(
    repoRoot,
    "src/assets/fonts/IBMPlexSans-VariableFont_wdth,wght.woff2",
  ),
  "IBMPlexMono-Regular.woff2": join(
    repoRoot,
    "src/assets/fonts/IBMPlexMono-Regular.woff2",
  ),
}

const copy = async (from: string, to: string) => {
  await Bun.write(to, Bun.file(from))
}

const copyFonts = async () => {
  const fontsOut = join(out, "fonts")
  await mkdir(fontsOut, { recursive: true })

  for (const name of await readdir(join(here, "fonts"))) {
    await copy(join(here, "fonts", name), join(fontsOut, name))
  }
  for (const [name, source] of Object.entries(FONT_SOURCES)) {
    if (!existsSync(source)) {
      console.warn(`playground: missing font ${source}, skipping ${name}`)
      continue
    }
    await copy(source, join(fontsOut, name))
  }
}

const linkVendor = async () => {
  const link = join(here, "vendor/justif")
  await mkdir(join(here, "vendor"), { recursive: true })
  await rm(link, { force: true, recursive: false })
  await symlink(justifRoot, link, "dir")
}

await mkdir(out, { recursive: true })
await linkVendor()

const result = await Bun.build({
  entrypoints: [join(here, "src/main.ts")],
  outdir: out,
  target: "browser",
  format: "esm",
  sourcemap: "linked",
  naming: { entry: "playground.[ext]" },
  plugins: [alias],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  throw new Error("playground: bundle failed")
}

await copy(join(here, "index.html"), join(out, "index.html"))
await copy(join(here, "playground.css"), join(out, "playground.css"))
await copy(join(packageRoot, "src/styles.css"), join(out, "linebreak.css"))
await copyFonts()

const bytes = result.outputs.reduce((total, file) => total + file.size, 0)
console.log(`playground: built ${(bytes / 1024).toFixed(0)} KB into ${out}`)
