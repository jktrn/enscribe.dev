import type { ComposeReason } from "../../types"
import { ATTRIBUTES } from "../../attributes"
import type { SourceRange } from "../../text/source"

export const OBJECT_REPLACEMENT = "￼"

export const LINE_SEPARATOR = "\n"

export const DECORATION = `[${ATTRIBUTES.decoration}][aria-hidden='true']`

type RunBase = {
  start: number
  end: number
  wrappers: HTMLElement[]
}

type TextRun = RunBase & {
  kind: "text"
  text: string
  sourceElement: HTMLElement

  hyphenates: boolean
}

type AtomRun = RunBase & {
  kind: "atom"
  sourceElement: Element
}

export type AnchorRun = RunBase & {
  kind: "anchor"
  sourceElement: HTMLElement

  affinity: "previous" | "next"
}

type BreakRun = RunBase & {
  kind: "break"
  sourceElement: HTMLElement
  forced: boolean
}

export type InlineRun = TextRun | AtomRun | AnchorRun | BreakRun

type Edge = { nodes: HTMLElement[]; width: number }

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
