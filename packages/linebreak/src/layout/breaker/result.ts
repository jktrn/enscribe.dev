import { newSum } from "../numeric/sum"
import { measureInto } from "./geometry"
import type { ActiveNode, Edge, Line, Measurement, Search } from "./types"

const lineTo = (
  search: Search,
  from: ActiveNode,
  node: ActiveNode,
  edge: Edge,
): Line => {
  const { boundary } = from
  const { start } = boundary
  const measured = { sum: newSum(search.diagnostics) } as Measurement
  measureInto(search, from, edge, measured, true)
  const { natural, stretch, shrink } = measured
  const sourceStart = boundary.sourceStart ?? edge.sourceEnd
  // Partial source metadata may end at the fallback zero. It cannot erase
  // the continuation offset already supplied by the preceding breakpoint.
  const sourceEnd = Math.max(sourceStart, edge.sourceEnd)
  const hasContent = start < edge.position
  return {
    start,
    end: edge.position,
    sourceStart,
    sourceEnd,
    naturalWidth: natural,
    spaceCount: edge.spaces - boundary.startSpaces,
    stretch,
    shrink,
    adjustmentRatio: node.ratio,
    breakKind: edge.breakKind,
    hangStart: hasContent ? boundary.hangStart : 0,
    hangEnd: hasContent ? edge.hangEnd : 0,
  }
}

export const linesFrom = (search: Search, final: ActiveNode): Line[] => {
  const lines: Line[] = []
  let index = search.edges.length - 1
  for (let node = final; node.previous; node = node.previous) {
    while ((search.edges[index] as Edge).position > node.boundary.position)
      index -= 1
    lines.push(lineTo(search, node.previous, node, search.edges[index] as Edge))
  }
  return lines.reverse()
}
