export type ProtrusionCodes = {
  readonly l?: number
  readonly r?: number
}

export type ProtrusionTable = Readonly<Record<string, ProtrusionCodes>>

export const latinProtrusion: ProtrusionTable = {
  "!": { r: 100 },
  '"': { l: 300, r: 300 },
  "%": { l: 50, r: 50 },
  "'": { l: 300, r: 400 },
  "(": { l: 100 },
  ")": { r: 200 },
  "*": { l: 200, r: 200 },
  "+": { l: 250, r: 250 },
  ",": { r: 500 },
  "-": { l: 500, r: 500 },
  ".": { r: 700 },
  "/": { l: 100, r: 200 },
  ":": { r: 500 },
  ";": { r: 300 },
  "<": { l: 200, r: 100 },
  ">": { l: 100, r: 200 },
  "?": { r: 100 },
  "@": { l: 50, r: 50 },
  "\\": { l: 100, r: 200 },
  _: { l: 100, r: 100 },
  "{": { l: 400, r: 200 },
  "}": { l: 200, r: 400 },
  "~": { l: 200, r: 250 },
  "¡": { l: 100 },
  "«": { l: 200, r: 200 },
  "»": { l: 200, r: 200 },
  "¿": { l: 100 },
  "‐": { l: 500, r: 500 },
  "–": { l: 200, r: 200 },
  "—": { l: 150, r: 150 },
  "‘": { l: 300, r: 400 },
  "’": { l: 300, r: 400 },
  "‚": { l: 400, r: 400 },
  "“": { l: 300, r: 300 },
  "”": { l: 300, r: 300 },
  "„": { l: 400, r: 400 },
  "‹": { l: 400, r: 300 },
  "›": { l: 300, r: 400 },
}

export const protrusionCode = (
  table: ProtrusionTable,
  character: string,
  side: "l" | "r",
): number => table[character]?.[side] ?? 0
