import type { ComposeReason } from "../../types"
import type { SourceRange } from "../../text/source"

export const OBJECT_REPLACEMENT = "￼"

export const LINE_SEPARATOR = "\n"

export const DECORATION = "[data-linebreak-decoration][aria-hidden='true']"

type RunBase = {
  text: string
  start: number
  end: number
  wrappers: HTMLElement[]
}

export type TextRun = RunBase & {
  kind: "text"
  sourceElement: HTMLElement

  hyphenates: boolean
}

export type AtomRun = RunBase & {
  kind: "atom"
  sourceElement: Element
  text: typeof OBJECT_REPLACEMENT
}

export type AnchorRun = RunBase & {
  kind: "anchor"
  sourceElement: HTMLElement
  text: ""

  affinity: "previous" | "next"
}

export type BreakRun = RunBase & {
  kind: "break"
  sourceElement: HTMLElement
  forced: boolean
}

export type InlineRun = TextRun | AtomRun | AnchorRun | BreakRun

export type Edge = { nodes: HTMLElement[]; width: number }

export type WrapperInfo = {
  start: number
  end: number
  firstRun: number
  lastRun: number
  leading: Edge
  trailing: Edge
}

export type ExtractedBlock = {
  text: string
  runs: InlineRun[]

  breakRestrictions: SourceRange[]
  wrappers: Map<HTMLElement, WrapperInfo>
}

export type ExtractResult =
  | { ok: true; block: ExtractedBlock }
  | { ok: false; reason: ComposeReason }

export const codeWrapper = (run: InlineRun) =>
  run.wrappers.find((wrapper) => wrapper.localName === "code")
