import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const RAMP_TOKEN =
  /--((?:background|foreground|accent)-l\d+):\s*light-dark\((#[0-9a-fA-F]{6}),\s*(#[0-9a-fA-F]{6})\)/g

export type ThemeMode = "light" | "dark"

export const ramp = (() => {
  const css = readFileSync(resolve("src/styles/color.css"), "utf8")
  const light = new Map<string, string>()
  const dark = new Map<string, string>()
  for (const [, token, lightHex, darkHex] of css.matchAll(RAMP_TOKEN)) {
    light.set(token, lightHex)
    dark.set(token, darkHex)
  }
  return { light, dark }
})()

const invert = (map: Map<string, string>) => {
  const out = new Map<string, string>()
  for (const [token, hex] of map) {
    if (!out.has(hex.toLowerCase())) out.set(hex.toLowerCase(), token)
  }
  return out
}
const tokensByHex = { light: invert(ramp.light), dark: invert(ramp.dark) }

export const tokenize = (svg: string, mode: ThemeMode) =>
  svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const token = tokensByHex[mode].get(hex.toLowerCase())
    return token ? `var(--${token})` : hex
  })

export const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

export const readSvgSource = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, "")
    .trim()

const prefixIds = (svg: string, prefix: string) =>
  svg
    .replace(/id="([^"]*)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]*)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]*)"/g, `href="#${prefix}-$1"`)

const accessibilityOf = (label?: string) =>
  label
    ? `role="img" aria-label="${escapeAttribute(label)}"`
    : 'aria-hidden="true"'

export function themeSvgSource(
  source: string,
  mode: ThemeMode,
  idPrefix: string,
  label?: string,
): string {
  return prefixIds(tokenize(source, mode), `${idPrefix}-${mode}`).replace(
    /<svg\b/,
    `<svg data-theme-${mode} ${accessibilityOf(label)}`,
  )
}

const TAG = /<[^>]+>/g
const PAINT = /\s(fill|stroke|stop-color|flood-color)="([^"]*)"/g
const DEFINITION = /\sid="([^"]*)"/
const REFERENCE = /url\(#([^)]*)\)|href="#([^"]*)"/g
const MAX_ALIGNMENT_CELLS = 16_000_000
const MIN_SHARED_FRACTION = 0.5

const shapeOf = (tag: string) =>
  tag
    .replace(PAINT, " $1")
    .replace(DEFINITION, ' id=""')
    .replace(REFERENCE, (reference) => reference.replace(/#[^)"]*/, "#"))

const referencesOf = (text: string) =>
  [...text.matchAll(REFERENCE)].map((match) => match[1] ?? match[2])

const renameReferences = (text: string, names: Map<string, string>) =>
  text.replace(REFERENCE, (reference, viaUrl, viaHref) => {
    const name = viaUrl ?? viaHref
    return reference.replace(`#${name}`, `#${names.get(name) ?? name}`)
  })

function alignShapes(light: string[], dark: string[]): [number, number][] {
  const columns = dark.length + 1
  const lengths = new Uint32Array((light.length + 1) * columns)
  for (let i = light.length - 1; i >= 0; i--) {
    for (let j = dark.length - 1; j >= 0; j--) {
      lengths[i * columns + j] =
        light[i] === dark[j]
          ? lengths[(i + 1) * columns + j + 1] + 1
          : Math.max(
              lengths[(i + 1) * columns + j],
              lengths[i * columns + j + 1],
            )
    }
  }

  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < light.length && j < dark.length) {
    if (light[i] === dark[j]) pairs.push([i++, j++])
    else if (lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1]) {
      i++
    } else j++
  }
  return pairs
}

function markTopLevel(tags: string[], mode: ThemeMode): string[] | null {
  let depth = 0
  const marked: string[] = []
  for (const tag of tags) {
    if (tag.startsWith("</")) {
      depth--
      if (depth < 0) return null
      marked.push(tag)
      continue
    }
    marked.push(
      depth === 0
        ? tag.replace(/^<[\w:-]+/, (name) => `${name} data-theme-${mode}`)
        : tag,
    )
    if (!tag.endsWith("/>")) depth++
  }
  return depth === 0 ? marked : null
}

const paintColor = (value: string) => (value === "none" ? "transparent" : value)

function mergeTag(
  light: string,
  dark: string,
  names: Map<string, string>,
): string | null {
  const lightReferences = referencesOf(light.replace(PAINT, ""))
  const darkReferences = referencesOf(dark.replace(PAINT, ""))
  if (
    darkReferences.some(
      (name, index) => names.get(name) !== lightReferences[index],
    )
  ) {
    return null
  }

  const darkPaints = [...dark.matchAll(PAINT)].map((match) =>
    renameReferences(match[2], names),
  )
  let index = 0
  let mergeable = true
  const merged = light.replace(PAINT, (attribute, name, lightPaint) => {
    const darkPaint = darkPaints[index++]
    if (lightPaint === darkPaint) return attribute
    if (lightPaint.includes("url(") || darkPaint.includes("url(")) {
      mergeable = false
      return attribute
    }
    return ` ${name}="light-dark(${paintColor(lightPaint)}, ${paintColor(darkPaint)})"`
  })
  return mergeable ? merged : null
}

export function mergeThemedSvg(light: string, dark: string): string | null {
  if (/<[!?]/.test(light + dark)) return null
  if (light.replace(TAG, "").trim() || dark.replace(TAG, "").trim()) return null
  const lightTags = light.match(TAG) ?? []
  const darkTags = dark.match(TAG) ?? []
  if (lightTags.length * darkTags.length > MAX_ALIGNMENT_CELLS) return null

  const pairs = alignShapes(lightTags.map(shapeOf), darkTags.map(shapeOf))
  if (pairs[0]?.[0] !== 0 || pairs[0]?.[1] !== 0) return null

  const sharedLength = pairs.reduce(
    (total, [i]) => total + lightTags[i].length,
    0,
  )
  if (sharedLength < light.length * MIN_SHARED_FRACTION) return null

  const names = new Map<string, string>()
  for (const [i, j] of pairs) {
    const lightName = DEFINITION.exec(lightTags[i])?.[1]
    const darkName = DEFINITION.exec(darkTags[j])?.[1]
    if (darkName === undefined || lightName === undefined) continue
    names.set(darkName, lightName)
  }
  const sharedDark = new Set(pairs.map(([, j]) => j))
  darkTags.forEach((tag, j) => {
    const name = DEFINITION.exec(tag)?.[1]
    if (name !== undefined && !sharedDark.has(j) && !names.has(name)) {
      names.set(name, `${name}-dark`)
    }
  })
  const renameDark = (tag: string) =>
    renameReferences(tag, names).replace(
      DEFINITION,
      (_, name) => ` id="${names.get(name) ?? name}"`,
    )

  const output: string[] = []
  let i = 0
  let j = 0
  for (const [lightIndex, darkIndex] of [
    ...pairs,
    [lightTags.length, darkTags.length] as [number, number],
  ]) {
    const lightOnly = markTopLevel(lightTags.slice(i, lightIndex), "light")
    const darkOnly = markTopLevel(
      darkTags.slice(j, darkIndex).map(renameDark),
      "dark",
    )
    if (!lightOnly || !darkOnly) return null
    output.push(...lightOnly, ...darkOnly)
    if (lightIndex < lightTags.length) {
      const lightTag = lightTags[lightIndex]
      const darkTag = renameDark(darkTags[darkIndex])
      const merged = mergeTag(lightTag, darkTags[darkIndex], names)
      if (merged !== null) output.push(merged)
      else if (lightTag.endsWith("/>")) {
        output.push(
          ...(markTopLevel([lightTag], "light") ?? []),
          ...(markTopLevel([darkTag], "dark") ?? []),
        )
      } else return null
    }
    i = lightIndex + 1
    j = darkIndex + 1
  }
  return output.join("")
}

export function themedSvgPair(
  light: string,
  dark: string,
  idPrefix: string,
  label?: string,
): string {
  const merged = mergeThemedSvg(
    tokenize(light, "light"),
    tokenize(dark, "dark"),
  )
  if (!merged) {
    return (
      themeSvgSource(light, "light", idPrefix, label) +
      themeSvgSource(dark, "dark", idPrefix, label)
    )
  }
  return prefixIds(merged, idPrefix).replace(
    /<svg\b/,
    `<svg ${accessibilityOf(label)}`,
  )
}
