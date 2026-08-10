import { FONTS } from "./fonts"
import { SAMPLES } from "./samples"

export type EngineId = "browser" | "linebreak" | "justif"

export type HangMode =
  | "none"
  | "line-end-only"
  | "first-line-and-line-ends"
  | "all-line-edges"

export type SweepAxis = "measure" | "size"

export type State = {
  sample: string
  font: string
  measure: number
  size: number
  hyphenate: boolean
  protrude: boolean
  expand: boolean
  track: boolean
  lastLineMinWidth: number
  emergencyStretch: number
  indent: number
  hang: HangMode
  view: "side" | "single"
  single: EngineId
  rulers: boolean
  tint: boolean
  boxes: boolean
  theme: "system" | "light" | "dark"
  sweepAxis: SweepAxis
}

export const DEFAULT_STATE: State = {
  sample: "austen-short",
  font: "md-lorien",
  measure: 380,
  size: 17,
  hyphenate: true,
  protrude: true,
  expand: true,
  track: false,
  lastLineMinWidth: 0.33,
  emergencyStretch: 12,
  indent: 0,
  hang: "line-end-only",
  view: "side",
  single: "linebreak",
  rulers: false,
  tint: false,
  boxes: false,
  theme: "system",
  sweepAxis: "measure",
}

export const ENGINES: readonly EngineId[] = ["browser", "linebreak", "justif"]

export const ENGINE_LABELS: Record<EngineId, string> = {
  browser: "browser",
  linebreak: "linebreak",
  justif: "justif",
}

export const RANGES = {
  measure: { min: 240, max: 900, step: 10 },
  size: { min: 13, max: 24, step: 0.5 },
  lastLineMinWidth: { min: 0, max: 0.5, step: 0.01 },
  emergencyStretch: { min: 0, max: 20, step: 1 },
  indent: { min: 0, max: 4, step: 0.25 },
} as const

const ENUMS = {
  hang: ["none", "line-end-only", "first-line-and-line-ends", "all-line-edges"],
  view: ["side", "single"],
  single: ["browser", "linebreak", "justif"],
  theme: ["system", "light", "dark"],
  sweepAxis: ["measure", "size"],
  sample: SAMPLES.map((sample) => sample.id),
  font: FONTS.map((font) => font.id),
} as const satisfies Partial<Record<keyof State, readonly string[]>>

const KEYS = Object.keys(DEFAULT_STATE) as (keyof State)[]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const readNumber = (key: keyof State, raw: string) => {
  const value = Number(raw)
  if (!Number.isFinite(value)) return undefined
  const range: { min: number; max: number } | undefined =
    RANGES[key as keyof typeof RANGES]
  return range === undefined ? value : clamp(value, range.min, range.max)
}

const readString = (key: keyof State, raw: string) => {
  const allowed: readonly string[] | undefined =
    ENUMS[key as keyof typeof ENUMS]
  if (allowed === undefined) return raw
  return allowed.includes(raw) ? raw : undefined
}

const readValue = (key: keyof State, raw: string) => {
  const fallback = DEFAULT_STATE[key]
  if (typeof fallback === "boolean") return raw === "1"
  if (typeof fallback === "number") return readNumber(key, raw)
  return readString(key, raw)
}

export const encodeState = (state: State) => {
  const params = new URLSearchParams()
  for (const key of KEYS) {
    const value = state[key]
    if (value === DEFAULT_STATE[key]) continue
    params.set(
      key,
      typeof value === "boolean" ? (value ? "1" : "0") : `${value}`,
    )
  }
  return params.toString()
}

export const decodeState = (hash: string): Partial<State> => {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const state: Record<string, unknown> = {}
  for (const key of KEYS) {
    const raw = params.get(key)
    if (raw === null) continue
    const value = readValue(key, raw)
    if (value !== undefined) state[key] = value
  }
  return state as Partial<State>
}

const STORE = "linebreak-playground"

const stored = (): Partial<State> => {
  try {
    const raw = localStorage.getItem(STORE)
    return raw === null ? {} : (JSON.parse(raw) as Partial<State>)
  } catch {
    return {}
  }
}

export const loadState = (): State => ({
  ...DEFAULT_STATE,
  ...stored(),
  ...decodeState(location.hash),
})

export const shareUrl = (state: State) => {
  const query = encodeState(state)
  const { origin, pathname, search } = location
  return `${origin}${pathname}${search}${query === "" ? "" : `#${query}`}`
}

export const saveState = (state: State) => {
  const query = encodeState(state)
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${query === "" ? "" : `#${query}`}`,
  )
  try {
    localStorage.setItem(STORE, JSON.stringify(state))
  } catch {
    return
  }
}
