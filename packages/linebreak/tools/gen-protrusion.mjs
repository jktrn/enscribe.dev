// Protrusion codes are extracted from microtype (c) 2004-2026 R Schlicht,
// distributed under the LaTeX Project Public License 1.3c. This script reads
// the `default` and `T1-default` \SetProtrusion blocks of microtype.dtx's
// `cfg-t` docstrip module, as selected by the generic `m-t` guard.

import { readFile, writeFile } from "node:fs/promises"

const SOURCE =
  "https://mirrors.ctan.org/macros/latex/contrib/microtype/microtype.dtx"

const NAMED = {
  "\\AE": "Æ",
  "\\OE": "Œ",
  "\\TH": "Þ",
  "\\comma": ",",
  "\\equals": "=",
  "\\guillemotleft": "«",
  "\\guillemotright": "»",
  "\\guilsinglleft": "‹",
  "\\guilsinglright": "›",
  "\\quotedblbase": "„",
  "\\quotesinglbase": "‚",
  "\\textbackslash": "\\",
  "\\textbar": "|",
  "\\textbraceleft": "{",
  "\\textbraceright": "}",
  "\\textemdash": "—",
  "\\textendash": "–",
  "\\textexclamdown": "¡",
  "\\textgreater": ">",
  "\\textless": "<",
  "\\textquestiondown": "¿",
  "\\textquotedbl": '"',
  "\\textquotedblleft": "“",
  "\\textquotedblright": "”",
  "\\textquoteleft": "‘",
  "\\textquoteright": "’",
  "\\%": "%",
  "\\#": "#",
  "\\&": "&",
  "\\_": "_",
}

const KEEP = new Set([
  ".",
  ",",
  ":",
  ";",
  "!",
  "?",
  "-",
  "–",
  "—",
  "‘",
  "’",
  "“",
  "”",
  "‚",
  "„",
  "‹",
  "›",
  "«",
  "»",
  "(",
  ")",
  "{",
  "}",
  "<",
  ">",
  "/",
  "\\",
  "_",
  "@",
  "~",
  "%",
  "*",
  "+",
  "¡",
  "¿",
])

const MIRRORED = [
  ["‐", "-"],
  ["'", "’"],
  ['"', "”"],
]

const selects = (guard, module) => {
  const cleaned = guard.replace(/^[*/]+/u, "")
  if (cleaned.length === 0) return true
  return cleaned.split("|").some((term) => {
    const negated = term.startsWith("!")
    const name = negated ? term.slice(1) : term
    return negated ? name !== module : name === module
  })
}

const blocksOf = (dtx) => {
  const start = dtx.indexOf("%<*cfg-t>")
  const end = dtx.indexOf("%</cfg-t>")
  if (start < 0 || end < 0) throw new Error("cfg-t module not found")
  return dtx.slice(start, end).split("\\SetProtrusion").slice(1)
}

const wanted = (block, names) =>
  names.some((name) =>
    new RegExp(`%<m-t>\\s*\\[\\s*name\\s*=\\s*${name}\\s*[,\\]]`, "u").test(
      block,
    ),
  )

const parseValue = (text) => {
  const [left = "", right = ""] = text.split(",")
  const codes = {}
  if (left.trim() !== "") codes.l = Number.parseInt(left, 10)
  if (right.trim() !== "") codes.r = Number.parseInt(right, 10)
  return codes
}

const parseBlock = (block, into) => {
  for (const raw of block.split("\n")) {
    const guarded = /^%<([^>]*)>(.*)$/u.exec(raw)
    if (guarded && !selects(guarded[1], "m-t")) continue
    const body = (guarded ? guarded[2] : raw)
      .replace(/(?<!\\)%.*$/u, "")
      .replaceAll("{,}", "\\comma")
      .replaceAll("{=}", "\\equals")
    for (const [, key, value] of body.matchAll(/(\S+)\s*=\s*\{([^}]*)\}/gu)) {
      const character = NAMED[key] ?? (key.length === 1 ? key : null)
      if (character === null) continue
      into.set(character, parseValue(value))
    }
  }
}

const format = (table) => {
  const lines = []
  for (const [character, codes] of table) {
    const parts = []
    if (codes.l !== undefined) parts.push(`l: ${codes.l}`)
    if (codes.r !== undefined) parts.push(`r: ${codes.r}`)
    lines.push(`  ${JSON.stringify(character)}: { ${parts.join(", ")} },`)
  }
  return `export type ProtrusionCodes = {
  readonly l?: number
  readonly r?: number
}

export type ProtrusionTable = Readonly<Record<string, ProtrusionCodes>>

export const latinProtrusion: ProtrusionTable = {
${lines.join("\n")}
}

export const protrusionCode = (
  table: ProtrusionTable,
  character: string,
  side: "l" | "r",
): number => table[character]?.[side] ?? 0
`
}

const main = async () => {
  const path = process.argv[2]
  if (!path) throw new Error("usage: gen-protrusion.mjs <out.ts> [dtx]")
  const local = process.argv[3]
  const dtx = local
    ? await (await import("node:fs/promises")).readFile(local, "utf8")
    : await (await fetch(SOURCE)).text()

  const collected = new Map()
  for (const block of blocksOf(dtx)) {
    if (!wanted(block, ["default", "T1-default"])) continue
    parseBlock(block, collected)
  }

  const table = new Map()
  for (const [character, codes] of collected) {
    if (KEEP.has(character)) table.set(character, codes)
  }
  for (const [character, source] of MIRRORED) {
    const codes = table.get(source)
    if (!codes) throw new Error(`no source codes for ${source}`)
    table.set(character, codes)
  }

  const sorted = new Map(
    [...table].sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0)),
  )
  await writeFile(path, format(sorted))
  console.log(`${sorted.size} characters -> ${path}`)
}

await main()
