import { readdirSync, readFileSync } from "node:fs"
import {
  linkIconAssetDirectory,
  linkIconAssetPath,
  linkIconAssets,
} from "../src/lib/link-icons"

const expectedNames = new Set(linkIconAssets)
const actualNames = new Set(
  readdirSync(linkIconAssetDirectory).filter((name) => name.endsWith(".svg")),
)
const errors: string[] = []

for (const name of linkIconAssets) {
  const path = linkIconAssetPath(name)

  if (!actualNames.has(name)) {
    errors.push(`missing: ${path}`)
    continue
  }

  const source = readFileSync(path, "utf8")
  if (!/^\s*<svg[\s>]/u.test(source)) errors.push(`not an SVG: ${path}`)
  if (!/\bviewBox=/u.test(source)) errors.push(`missing viewBox: ${path}`)
  if (/<(?:script|image|foreignObject)\b/iu.test(source)) {
    errors.push(`contains unsafe embedded content: ${path}`)
  }
  if (/\b(?:href|xlink:href)\s*=/iu.test(source)) {
    errors.push(`contains an external reference: ${path}`)
  }
}

for (const name of actualNames) {
  if (!expectedNames.has(name)) {
    errors.push(`unregistered: ${linkIconAssetDirectory}/${name}`)
  }
}

if (errors.length > 0) {
  throw new Error(`Vendored favicon validation failed:\n${errors.join("\n")}`)
}

console.log(`Verified ${linkIconAssets.length} vendored favicon assets.`)
