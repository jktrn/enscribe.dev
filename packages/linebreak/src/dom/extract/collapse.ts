import {
  collapseWhitespace,
  hasVisibleText,
  type SourceRange,
} from "../../text/source"
import { type AnchorRun, type InlineRun, LINE_SEPARATOR } from "./runs"
import type { Raw, RawAtom, RawBreak, RawText } from "./walk"

type PendingSpace = {
  first: RawText
  anchors: Map<HTMLElement[], RawText>
  hasWrappingContributor: boolean
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
    if (raw.forced && this.pending) {
      for (const from of this.pending.anchors.values()) {
        this.appendAnchor(from, this.text.length, "previous")
      }
      this.pending = undefined
    }
    this.flushSpace()
    this.closeNoWrap()

    const start = this.text.length
    if (raw.forced) this.text += LINE_SEPARATOR
    this.runs.push({
      kind: "break",
      text: raw.forced ? LINE_SEPARATOR : "",
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
    this.noteNoWrap(raw.noWrapOwner, start, this.text.length, false)
    this.runs.push({
      kind: "atom",
      text: raw.text,
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
      for (const from of this.pending.anchors.values()) {
        this.appendAnchor(from, this.text.length, "previous")
      }
    }
    this.closeNoWrap()
  }

  private addRestriction(start: number, end: number) {
    if (start >= end) return
    const previous = this.restrictions.at(-1)
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end)
    } else {
      this.restrictions.push({ start, end })
    }
  }

  private closeNoWrap() {
    if (!this.noWrap) return
    this.addRestriction(this.noWrap.start, this.noWrap.end)
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
        this.noWrap = { owner, start: start + 1, end: restrictionEnd }
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
    if (!value) return
    const start = this.text.length
    this.text += value
    this.noteNoWrap(owner, start, this.text.length, includeBoundary)

    const hyphenates = from.noWrapOwner === undefined
    const previous = this.runs.at(-1)
    if (
      previous?.kind === "text" &&
      previous.sourceElement === from.sourceElement &&
      previous.wrappers === from.wrappers &&
      previous.hyphenates === hyphenates
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
      text: "",
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
      this.pending.hasWrappingContributor ||= from.noWrapOwner === undefined
      if (anchor && !this.pending.anchors.has(from.wrappers)) {
        this.pending.anchors.set(from.wrappers, from)
      }
      return
    }
    this.pending = {
      first: from,
      anchors: new Map(anchor ? [[from.wrappers, from]] : []),
      hasWrappingContributor: from.noWrapOwner === undefined,
    }
  }

  private anchorAll(space: PendingSpace, at: number) {
    for (const from of space.anchors.values()) {
      this.appendAnchor(from, at, "next")
    }
  }

  private flushSpace() {
    if (!this.pending) return
    const space = this.pending
    this.pending = undefined

    if (this.text.length === 0 || this.text.endsWith(LINE_SEPARATOR)) {
      this.anchorAll(space, this.text.length)
      return
    }

    const start = this.text.length
    const firstAnchor = space.anchors.get(space.first.wrappers)
    if (firstAnchor) this.appendAnchor(firstAnchor, start, "next")
    this.appendText(
      " ",
      space.first,
      space.hasWrappingContributor ? undefined : space.first.noWrapOwner,
      !space.hasWrappingContributor,
    )
    this.closeAnchors(space, firstAnchor)
  }

  private closeAnchors(space: PendingSpace, firstAnchor: RawText | undefined) {
    const end = this.text.length
    if (firstAnchor) this.appendAnchor(firstAnchor, end, "previous")
    for (const from of space.anchors.values()) {
      if (from !== firstAnchor) this.appendAnchor(from, end, "previous")
    }
  }
}
