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

export function themeSvgSource(
  source: string,
  mode: ThemeMode,
  idPrefix: string,
  label?: string,
): string {
  const prefix = `${idPrefix}-${mode}`
  const accessibility = label
    ? `role="img" aria-label="${escapeAttribute(label)}"`
    : 'aria-hidden="true"'
  return tokenize(source, mode)
    .replace(/id="([^"]*)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]*)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]*)"/g, `href="#${prefix}-$1"`)
    .replace(/<svg\b/, `<svg data-theme-${mode} ${accessibility}`)
}
