import { cssPixels, type StyleReader } from "../style"
import {
  DECORATION,
  type ExtractedBlock,
  type InlineRun,
  type WrapperInfo,
} from "./runs"

export const outerWidth = (element: Element, styleOf: StyleReader) => {
  const style = styleOf(element)
  if (style.display === "none") return 0
  return (
    element.getBoundingClientRect().width +
    cssPixels(style.marginInlineStart) +
    cssPixels(style.marginInlineEnd)
  )
}

const inlineEdges = (style: CSSStyleDeclaration) => {
  if (style.display === "contents") return { leading: 0, trailing: 0 }
  return {
    leading:
      cssPixels(style.marginInlineStart) +
      cssPixels(style.borderInlineStartWidth) +
      cssPixels(style.paddingInlineStart),
    trailing:
      cssPixels(style.paddingInlineEnd) +
      cssPixels(style.borderInlineEndWidth) +
      cssPixels(style.marginInlineEnd),
  }
}

export const buildWrapperInfo = (runs: InlineRun[], styleOf: StyleReader) => {
  const spans = new Map<HTMLElement, { firstRun: number; lastRun: number }>()
  for (let index = 0; index < runs.length; index += 1) {
    for (const wrapper of (runs[index] as InlineRun).wrappers) {
      const span = spans.get(wrapper)
      if (span) span.lastRun = index
      else spans.set(wrapper, { firstRun: index, lastRun: index })
    }
  }

  const wrappers = new Map<HTMLElement, WrapperInfo>()
  for (const [element, { firstRun, lastRun }] of spans) {
    const edges = inlineEdges(styleOf(element))
    const leading: HTMLElement[] = []
    const trailing: HTMLElement[] = []
    for (const decoration of element.querySelectorAll<HTMLElement>(
      `:scope > ${DECORATION}`,
    )) {
      const width = outerWidth(decoration, styleOf)
      if (decoration.dataset.linebreakDecorationPosition === "after") {
        trailing.push(decoration)
        edges.trailing += width
      } else {
        leading.push(decoration)
        edges.leading += width
      }
    }
    wrappers.set(element, {
      start: (runs[firstRun] as InlineRun).start,
      end: (runs[lastRun] as InlineRun).end,
      firstRun,
      lastRun,
      leading: { nodes: leading, width: edges.leading },
      trailing: { nodes: trailing, width: edges.trailing },
    })
  }
  return wrappers
}

export const runEdgeWidths = (block: ExtractedBlock, run: InlineRun) =>
  run.wrappers.reduce(
    (total, wrapper) => {
      const info = block.wrappers.get(wrapper)
      if (!info) return total
      if (block.runs[info.firstRun] === run) total.leading += info.leading.width
      if (block.runs[info.lastRun] === run)
        total.trailing += info.trailing.width
      return total
    },
    { leading: 0, trailing: 0 },
  )
