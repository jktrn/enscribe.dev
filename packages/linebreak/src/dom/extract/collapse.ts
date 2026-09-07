import {
  collapseWhitespace,
  hasVisibleText,
  type SourceRange,
} from "../../text/source"
import { type AnchorRun, type InlineRun, LINE_SEPARATOR } from "./runs"
import type { Raw, RawAtom, RawBreak, RawText } from "./walk"
import { appendRestriction } from "./restrictions"

type PendingSpace = {
  readonly first: RawText
  readonly markers: Map<HTMLElement[] | RawBreak, RawText | RawBreak>
  owner: Element | undefined
}

type ActiveNoWrap = SourceRange & { owner: Element }

export class Collapser {
  private text = ""
  private readonly runs: InlineRun[] = []
  private readonly restrictions: SourceRange[] = []
  private readonly contentWrappers: Set<HTMLElement>
  private noWrap: ActiveNoWrap | undefined
  private pending: PendingSpace | undefined

  constructor(raws: readonly Raw[]) {
    this.contentWrappers = new Set()
    for (const raw of raws) {
      if (raw.kind !== "text" || hasVisibleText(raw.text)) {
        for (const wrapper of raw.wrappers) this.contentWrappers.add(wrapper)
      }
    }
  }

  static collapse(raws: readonly Raw[]) {
    const collapser = new Collapser(raws)
    for (const raw of raws) collapser.take(raw)
    collapser.finish()
    return {
      text: collapser.text,
      runs: collapser.runs,
      breakRestrictions: collapser.restrictions,
    }
  }

  private take(raw: Raw) {
    if (raw.kind === "break") return this.takeBreak(raw)
    if (raw.kind === "atom") return this.takeAtom(raw)
    return this.takeText(raw)
  }

  private takeBreak(raw: RawBreak) {
    if (!raw.forced && this.pending) {
      this.pending.markers.set(raw, raw)
      return
    }
    if (this.pending) {
      this.appendMarkers(this.pending, "previous")
      this.pending = undefined
    }
    this.appendBreak(raw)
  }

  private appendBreak(raw: RawBreak) {
    this.closeNoWrap()

    const start = this.text.length
    if (raw.forced) this.text += LINE_SEPARATOR
    this.runs.push({
      kind: "break",
      start,
      end: this.text.length,
      wrappers: raw.wrappers,
      sourceElement: raw.sourceElement,
      forced: raw.forced,
    })
  }

  private takeAtom(raw: RawAtom) {
    this.flushSpace()
    const start = this.text.length
    this.text += raw.text
    // restrictAtoms handles the boundaries; the next text run resumes ownership.
    this.runs.push({
      kind: "atom",
      start,
      end: this.text.length,
      wrappers: raw.wrappers,
      sourceElement: raw.sourceElement,
    })
  }

  private takeText(raw: RawText) {
    let value = collapseWhitespace(raw.text)
    if (value.startsWith(" ")) {
      this.contributeSpace(raw)
      value = value.slice(1)
    }
    if (!value) return

    this.flushSpace()
    if (value.endsWith(" ")) {
      this.appendText(value.slice(0, -1), raw, raw.noWrapOwner)
      this.contributeSpace(raw)
    } else {
      this.appendText(value, raw, raw.noWrapOwner)
    }
  }

  private finish() {
    if (this.pending) {
      this.appendMarkers(this.pending, "previous")
    }
    this.closeNoWrap()
  }

  private closeNoWrap() {
    if (!this.noWrap) return
    appendRestriction(this.restrictions, this.noWrap.start, this.noWrap.end)
    this.noWrap = undefined
  }

  private noteNoWrap(
    owner: Element | undefined,
    start: number,
    end: number,
    includeBoundary: boolean,
  ) {
    const restrictionEnd = includeBoundary ? end + 1 : end
    if (this.noWrap?.owner !== owner) {
      this.closeNoWrap()
      if (owner) {
        this.noWrap = { owner, start, end: restrictionEnd }
      }
      return
    }
    if (this.noWrap) this.noWrap.end = restrictionEnd
  }

  private appendText(
    value: string,
    from: RawText,
    owner: Element | undefined,
    includeBoundary = false,
  ) {
    const start = this.text.length
    this.text += value
    // SHY and ZWSP own their soft opportunity even at the run's first offset.
    const firstBreak = /^[\u00ad\u200b]/u.test(value) ? start : start + 1
    this.noteNoWrap(owner, firstBreak, this.text.length, includeBoundary)

    const hyphenates = from.noWrapOwner === undefined
    const previous = this.runs.at(-1)
    // Within one extraction, an element fixes its ancestry and whitespace policy.
    if (
      previous?.kind === "text" &&
      previous.sourceElement === from.sourceElement
    ) {
      previous.text += value
      previous.end = this.text.length
      return
    }
    this.runs.push({
      kind: "text",
      text: value,
      start,
      end: this.text.length,
      wrappers: from.wrappers,
      sourceElement: from.sourceElement,
      hyphenates,
    })
  }

  private appendAnchor(
    from: RawText,
    offset: number,
    affinity: AnchorRun["affinity"],
  ) {
    this.runs.push({
      kind: "anchor",
      start: offset,
      end: offset,
      wrappers: from.wrappers,
      sourceElement: from.sourceElement,
      affinity,
    })
  }

  private needsAnchor(from: RawText) {
    return from.wrappers.some((wrapper) => !this.contentWrappers.has(wrapper))
  }

  private contributeSpace(from: RawText) {
    const anchor = this.needsAnchor(from)
    if (this.pending) {
      if (from.noWrapOwner === undefined) this.pending.owner = undefined
      if (anchor) this.pending.markers.set(from.wrappers, from)
      return
    }
    this.pending = {
      first: from,
      markers: new Map(anchor ? [[from.wrappers, from]] : []),
      owner: from.noWrapOwner,
    }
  }

  private appendMarkers(space: PendingSpace, affinity: AnchorRun["affinity"]) {
    for (const marker of space.markers.values()) {
      if (marker.kind === "break") this.appendBreak(marker)
      else this.appendAnchor(marker, this.text.length, affinity)
    }
  }

  private flushSpace() {
    if (!this.pending) return
    const space = this.pending
    this.pending = undefined

    if (this.text.length === 0 || this.text.endsWith(LINE_SEPARATOR)) {
      this.appendMarkers(space, "next")
      return
    }

    let written = false
    for (const marker of space.markers.values()) {
      if (marker.kind === "break") {
        if (!written) this.appendSpace(space)
        written = true
        this.appendBreak(marker)
      } else {
        this.appendAnchor(
          marker,
          this.text.length,
          written ? "next" : "previous",
        )
      }
    }
    if (!written) this.appendSpace(space)
  }

  private appendSpace(space: PendingSpace) {
    this.appendText(" ", space.first, space.owner, true)
  }
}
