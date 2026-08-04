export type EngineId = "browser" | "linebreak" | "justif"

export type HangMode =
  | "none"
  | "line-end-only"
  | "first-line-and-line-ends"
  | "all-line-edges"

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
  indent: number
  hang: HangMode
  view: "side" | "single"
  single: EngineId
  rulers: boolean
  tint: boolean
  boxes: boolean
  theme: "system" | "light" | "dark"
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
  indent: 0,
  hang: "line-end-only",
  view: "side",
  single: "linebreak",
  rulers: false,
  tint: false,
  boxes: false,
  theme: "system",
}

const STORE = "linebreak-playground"

export const loadState = (): State => {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw === null) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export const saveState = (state: State) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(state))
  } catch {
    return
  }
}
