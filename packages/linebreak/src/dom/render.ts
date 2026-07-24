import type { OptimizedLine } from "../layout/line-model"
import type { ExtractedBlock } from "./extract"
import type { AuthoredSpacing } from "./spacing"

const appendRange = (
  target: Node,
  extracted: ExtractedBlock,
  rawStart: number,
  rawEnd: number,
  firstItemIndex: number,
) => {
  let start = rawStart
  let end = rawEnd
  while (extracted.text[start] === " ") start += 1
  while (end > start && extracted.text[end - 1] === " ") end -= 1

  let lastBranch: Node | null = null
  let previousWrappers: HTMLElement[] = []
  const previousClones: HTMLElement[] = []
  const trailingEdges: {
    nodes: HTMLElement[]
    target: HTMLElement
  }[] = []
  let nextItemIndex = firstItemIndex
  const isBeforeLine = (item: ExtractedBlock["items"][number]) =>
    item.kind === "anchor"
      ? item.affinity === "previous"
        ? item.start <= rawStart
        : item.start < rawStart
      : item.end <= rawStart
  const isAfterLine = (item: ExtractedBlock["items"][number]) =>
    item.kind === "anchor"
      ? item.affinity === "previous"
        ? item.start > rawEnd
        : item.start >= rawEnd
      : item.start >= rawEnd

  while (
    nextItemIndex < extracted.items.length &&
    isBeforeLine(extracted.items[nextItemIndex])
  ) {
    nextItemIndex += 1
  }

  for (
    let itemIndex = nextItemIndex;
    itemIndex < extracted.items.length;
    itemIndex += 1
  ) {
    const item = extracted.items[itemIndex]
    if (isAfterLine(item)) break
    const sliceStart = Math.max(start, item.start)
    const sliceEnd = Math.min(end, item.end)
    const isAnchor = item.kind === "anchor"
    if (isAnchor || item.end <= rawEnd) nextItemIndex = itemIndex + 1
    if (!isAnchor && sliceStart >= sliceEnd) continue

    let commonWrapperCount = 0
    while (
      commonWrapperCount < item.wrappers.length &&
      item.wrappers[commonWrapperCount] === previousWrappers[commonWrapperCount]
    ) {
      commonWrapperCount += 1
    }

    previousClones.length = commonWrapperCount
    let branch: Node = previousClones.at(-1) ?? target
    for (
      let index = commonWrapperCount;
      index < item.wrappers.length;
      index += 1
    ) {
      const wrapper = item.wrappers[index]
      const info = extracted.wrappers.get(wrapper)
      if (!info) return null
      const fragment = {
        startsWrapper: rawStart <= info.start,
        endsWrapper: rawEnd >= info.end,
      }
      const clone = wrapper.cloneNode(false) as HTMLElement
      clone.removeAttribute("id")
      clone.dataset.kpInlineFragment = ""
      if (fragment.startsWrapper) clone.dataset.kpFragmentStart = ""
      if (fragment.endsWrapper) clone.dataset.kpFragmentEnd = ""
      if (
        fragment.startsWrapper &&
        (isAnchor || sliceStart === item.start) &&
        info.firstItem === itemIndex
      ) {
        clone.append(...info.leading.nodes.map((node) => node.cloneNode(true)))
      }
      branch.appendChild(clone)
      if (fragment.endsWrapper) {
        trailingEdges.push({ nodes: info.trailing.nodes, target: clone })
      }
      branch = clone
      previousClones.push(clone)
    }
    if (item.kind === "box") {
      branch.appendChild(item.sourceElement.cloneNode(true))
    } else if (item.kind === "text") {
      branch.appendChild(
        document.createTextNode(
          item.text.slice(sliceStart - item.start, sliceEnd - item.start),
        ),
      )
    }
    lastBranch = branch
    previousWrappers = item.wrappers
  }

  for (const edge of trailingEdges) {
    edge.target.append(...edge.nodes.map((node) => node.cloneNode(true)))
  }

  return lastBranch ? { lastBranch, nextItemIndex } : null
}

export const preserveImageAttributes = (
  block: HTMLElement,
  replacement: ParentNode,
  attributes: readonly string[],
) => {
  if (attributes.length === 0) return
  const images = block.querySelectorAll<HTMLImageElement>("img")
  if (images.length === 0) return

  const current = new Map<string, HTMLImageElement[]>()
  for (const image of images) {
    const source = image.getAttribute("src") ?? ""
    const matches = current.get(source) ?? []
    matches.push(image)
    current.set(source, matches)
  }
  for (const matches of current.values()) matches.reverse()
  for (const image of replacement.querySelectorAll<HTMLImageElement>("img")) {
    const source = current.get(image.getAttribute("src") ?? "")?.pop()
    if (!source) continue
    for (const attribute of attributes) {
      const value = source.getAttribute(attribute)
      if (value === null) image.removeAttribute(attribute)
      else image.setAttribute(attribute, value)
    }
  }
}

export const renderLines = (
  block: HTMLElement,
  extracted: ExtractedBlock,
  lines: OptimizedLine[],
  authoredSpacing: AuthoredSpacing,
  preserveImageAttributesList: readonly string[] = [],
) => {
  const output = document.createDocumentFragment()
  const lineElements: HTMLElement[] = []
  let firstItemIndex = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const isLast = index === lines.length - 1
    const target = document.createElement("span")
    target.className = isLast ? "kp-line kp-final-line" : "kp-line"
    target.style.setProperty(
      "--kp-base-word-spacing",
      authoredSpacing.wordSpacing,
    )
    target.style.setProperty(
      "--kp-word-spacing-delta",
      `${isLast ? 0 : line.wordSpacing}px`,
    )
    target.style.setProperty(
      "--kp-base-letter-spacing",
      authoredSpacing.letterSpacing,
    )
    target.style.setProperty(
      "--kp-letter-spacing-delta",
      `${isLast ? 0 : line.letterSpacing}px`,
    )

    const rendered = appendRange(
      target,
      extracted,
      line.start,
      line.end,
      firstItemIndex,
    )
    if (!rendered) return null
    firstItemIndex = rendered.nextItemIndex

    if (line.discretionaryHyphen) {
      const hyphen = document.createElement("span")
      hyphen.className = "kp-hyphen"
      hyphen.setAttribute("aria-hidden", "true")
      hyphen.textContent = "-"
      rendered.lastBranch.appendChild(hyphen)
    }

    output.appendChild(target)
    lineElements.push(target)
    if (!isLast) {
      const lineBreak = document.createElement("br")
      lineBreak.className = "kp-break"
      lineBreak.dataset.break = line.breakKind
      output.appendChild(lineBreak)
    }
  }

  preserveImageAttributes(block, output, preserveImageAttributesList)
  block.replaceChildren(output)
  block.dataset.kpJustified = ""
  block.dataset.kpLines = String(lines.length)
  return lineElements
}
