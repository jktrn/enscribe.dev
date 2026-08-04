import { existsSync, readFileSync } from "node:fs"
import { mkdir, rm, symlink } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))

export const justifRoot = resolve(
  process.env.JUSTIF_PATH ?? join(homedir(), ".linebreak-bench/justif"),
)

if (!existsSync(join(justifRoot, "src/index.ts"))) {
  throw new Error(
    `justif sources not found at ${justifRoot}. Clone justif there or set ` +
      "JUSTIF_PATH to its checkout.",
  )
}

export const justifVersion = (() => {
  try {
    const manifest = readFileSync(join(justifRoot, "package.json"), "utf8")
    return (JSON.parse(manifest) as { version?: string }).version ?? "unknown"
  } catch {
    return "unknown"
  }
})()

/**
 * Points `playground/vendor/justif` at the checkout. Vite resolves justif
 * through an alias and needs no symlink, but tsconfig `paths` cannot read an
 * environment variable, so the typechecker reaches the sources through here.
 */
export const linkVendor = async () => {
  const link = join(here, "vendor/justif")
  await mkdir(join(here, "vendor"), { recursive: true })
  await rm(link, { force: true, recursive: false })
  await symlink(justifRoot, link, "dir")
  return link
}

if (import.meta.main) console.log(await linkVendor())
