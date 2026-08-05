import { existsSync } from "node:fs"
import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig, type Plugin } from "vite"
import { justifRoot, justifVersion, linkVendor } from "./justif.ts"

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, "..")
const repoRoot = resolve(packageRoot, "../..")
const publicFonts = join(here, "public/fonts")

/**
 * Faces the playground needs that live outside it. These are licensed and
 * gitignored, hydrated into the repo by `bun run fonts:prepare`, so they are
 * staged into `public/fonts` rather than committed there.
 */
const LICENSED_FONTS: Record<string, string> = {
  "MDLorien-Regular.woff2": "src/assets/fonts/MDLorien-Regular.woff2",
  "MDLorien-Italic.woff2": "src/assets/fonts/MDLorien-Italic.woff2",
  "IBMPlexSans-Variable.woff2":
    "src/assets/fonts/IBMPlexSans-VariableFont_wdth,wght.woff2",
  "IBMPlexMono-Regular.woff2": "src/assets/fonts/IBMPlexMono-Regular.woff2",
}

const stageFonts = async () => {
  await mkdir(publicFonts, { recursive: true })
  for (const [name, relative] of Object.entries(LICENSED_FONTS)) {
    const source = join(repoRoot, relative)
    if (!existsSync(source)) {
      console.warn(`playground: missing font ${source}, skipping ${name}`)
      continue
    }
    await copyFile(source, join(publicFonts, name))
  }
}

/**
 * Stages the licensed faces into `public/fonts` and keeps `vendor/justif`
 * pointing at the checkout. Together these replace the copy and symlink steps
 * the old `build.ts` ran before bundling.
 *
 * This has to run in `config`, not `buildStart`. In dev the server begins
 * serving before `buildStart`, and it takes the public directory as it finds
 * it then: a face staged later answers with the SPA fallback instead of the
 * file, so the first run after a fresh checkout renders every licensed face
 * in the fallback and reports `FontFace.status === "error"`.
 */
const prepare = (): Plugin => ({
  name: "playground-prepare",
  async config() {
    await Promise.all([stageFonts(), linkVendor()])
  },
})

export default defineConfig({
  root: here,
  plugins: [svelte(), prepare()],
  define: {
    __JUSTIF_VERSION__: JSON.stringify(justifVersion),
  },
  resolve: {
    alias: {
      "@enscribe/linebreak/hyphenation": join(
        packageRoot,
        "src/hyphenation.ts",
      ),
      "@enscribe/linebreak/styles.css": join(packageRoot, "src/styles.css"),
      "@enscribe/linebreak": join(packageRoot, "src/index.ts"),
      "justif/hyphenate/en-us": join(justifRoot, "src/hyphenation/en-us.ts"),
      justif: join(justifRoot, "src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    fs: { allow: [repoRoot, justifRoot] },
  },
  build: {
    outDir: join(here, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
})
