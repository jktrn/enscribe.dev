import type { Line } from "../layout/breaker"
import { type ExtractedBlock, type InlineRun, LINE_SEPARATOR } from "./extract"

export const LINE_SELECTOR = "[data-linebreak-line]"
export const TYPESET_ATTRIBUTE = "data-linebreak-typeset"
export const TYPESET_SELECTOR = "[data-linebreak-typeset]"

const appendLine = (
  target: HTMLElement,
  block: ExtractedBlock,
  line: Line,
  fromRun: number,
) => {
  const blank = (offset: number) =>
    block.text[offset] === " " || block.text[offset] === LINE_SEPARATOR
  let start = line.sourceStart
  let end = line.sourceEnd
  while (start < end && blank(start)) start += 1
  while (end > start && blank(end - 1)) end -= 1

  let lastBranch: Node | null = null
  let previousWrappers: HTMLElement[] = []
  const openClones: HTMLElement[] = []
  const trailingEdges: Array<{ nodes: HTMLElement[]; target: HTMLElement }> = []
  let nextRun = fromRun

  const beforeLine = (run: InlineRun) =>
    run.kind === "anchor"
      ? run.affinity === "previous"
        ? run.start <= line.sourceStart
        : run.start < line.sourceStart
      : run.end <= line.sourceStart
  const afterLine = (run: InlineRun) =>
    run.kind === "anchor"
      ? run.affinity === "previous"
        ? run.start > line.sourceEnd
        : run.start >= line.sourceEnd
      : run.start >= line.sourceEnd

  while (
    nextRun < block.runs.length &&
    beforeLine(block.runs[nextRun] as InlineRun)
  ) {
    nextRun += 1
  }

  for (let index = nextRun; index < block.runs.length; index += 1) {
    const run = block.runs[index] as InlineRun
    if (afterLine(run)) break
    const sliceStart = Math.max(start, run.start)
    const sliceEnd = Math.min(end, run.end)
    const isAnchor = run.kind === "anchor"
    if (isAnchor || run.end <= line.sourceEnd) nextRun = index + 1
    if (!isAnchor && sliceStart >= sliceEnd) continue

    let shared = 0
    while (
      shared < run.wrappers.length &&
      run.wrappers[shared] === previousWrappers[shared]
    ) {
      shared += 1
    }

    openClones.length = shared
    let branch: Node = openClones.at(-1) ?? target
    for (let depth = shared; depth < run.wrappers.length; depth += 1) {
      const wrapper = run.wrappers[depth] as HTMLElement
      const info = block.wrappers.get(wrapper)
      if (!info) return null
      const startsWrapper = line.sourceStart <= info.start
      const endsWrapper = line.sourceEnd >= info.end

      const clone = wrapper.cloneNode(false) as HTMLElement

      if (!startsWrapper) clone.removeAttribute("id")
      clone.dataset.linebreakFragment = ""
      if (startsWrapper) clone.dataset.linebreakFragmentStart = ""
      if (endsWrapper) clone.dataset.linebreakFragmentEnd = ""
      if (
        startsWrapper &&
        (isAnchor || sliceStart === run.start) &&
        info.firstRun === index
      ) {
        clone.append(...info.leading.nodes.map((node) => node.cloneNode(true)))
      }
      branch.appendChild(clone)
      if (endsWrapper)
        trailingEdges.push({ nodes: info.trailing.nodes, target: clone })
      branch = clone
      openClones.push(clone)
    }

    if (run.kind === "atom") {
      branch.appendChild(run.sourceElement.cloneNode(true))
    } else if (run.kind === "text") {
      branch.appendChild(
        target.ownerDocument.createTextNode(
          run.text.slice(sliceStart - run.start, sliceEnd - run.start),
        ),
      )
    }
    lastBranch = branch
    previousWrappers = run.wrappers
  }

  for (const edge of trailingEdges) {
    edge.target.append(...edge.nodes.map((node) => node.cloneNode(true)))
  }

  return lastBranch ? { lastBranch, nextRun } : null
}

export const preserveImageAttributes = (
  block: HTMLElement,
  replacement: ParentNode,
  attributes: readonly string[],
) => {
  if (attributes.length === 0) return
  const originals = block.querySelectorAll<HTMLImageElement>("img")
  const replacements = replacement.querySelectorAll<HTMLImageElement>("img")
  if (originals.length !== replacements.length) return

  for (const [index, image] of replacements.entries()) {
    const original = originals[index]
    if (!original) continue
    for (const attribute of attributes) {
      const value = original.getAttribute(attribute)
      if (value === null) image.removeAttribute(attribute)
      else image.setAttribute(attribute, value)
    }
  }
}

export const renderLines = (
  element: HTMLElement,
  block: ExtractedBlock,
  lines: readonly Line[],
  targetWidth: number,
  preservedImageAttributes: readonly string[],
) => {
  const document = element.ownerDocument
  const output = document.createDocumentFragment()
  const lineElements: HTMLElement[] = []
  let nextRun = 0

  for (const line of lines) {
    const target = document.createElement("span")
    target.dataset.linebreakLine = line.breakKind

    const overflow = Math.min(line.naturalWidth - targetWidth, line.shrink)
    if (overflow > 0 && line.spaceCount > 0) {
      target.style.wordSpacing = `${-(overflow / line.spaceCount)}px`
    }

    const rendered = appendLine(target, block, line, nextRun)
    if (!rendered) return null
    nextRun = rendered.nextRun

    // Put the consumed inter-word space back. A trailing space at the end of a
    // line box is hung and dropped for justification (CSS Text 3 §5.3), so it
    // is visually inert — but without it, find-in-page, scroll-to-text,
    // translation, and `textContent` all break across every line boundary.
    if (line.breakKind === "space") {
      target.appendChild(document.createTextNode(" "))
    }

    output.appendChild(target)
    lineElements.push(target)
  }

  preserveImageAttributes(element, output, preservedImageAttributes)
  element.replaceChildren(output)
  element.setAttribute(TYPESET_ATTRIBUTE, String(lines.length))
  return lineElements
}
