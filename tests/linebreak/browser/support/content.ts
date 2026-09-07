import { extractBlock, type ExtractedBlock } from "@linebreak/dom/extract"
import { renderLines } from "@linebreak/dom/render"
import type { Line } from "@linebreak/layout/breaker"

export const source = (html: string) => {
  const host = document.createElement("p")
  host.innerHTML = html
  document.body.append(host)
  const read = (element: Element) =>
    new Proxy(getComputedStyle(element), {
      get(target, property) {
        if (property === "whiteSpaceCollapse") return "collapse"
        if (property === "textWrapMode") return target.whiteSpace === "nowrap" ? "nowrap" : "wrap"
        if (property === "display") return target.display || "inline"
        return Reflect.get(target, property)
      },
    })
  const extracted = extractBlock(host, read)
  if (!extracted.ok) throw new Error(extracted.reason)
  return { host, block: extracted.block }
}

export const line = (
  start: number,
  end: number,
  breakKind: Line["breakKind"] = "end",
): Line => ({
  start: 0,
  end: 1,
  sourceStart: start,
  sourceEnd: end,
  naturalWidth: 100,
  spaceCount: 1,
  stretch: 10,
  shrink: 5,
  adjustmentRatio: 0,
  breakKind,
  hangStart: 0,
  hangEnd: 0,
})

export const render = (
  host: HTMLElement,
  block: ExtractedBlock,
  lines: readonly Line[],
) =>
  renderLines(
    host,
    block,
    { lines, target: 100, fits: null, letterfit: null },
    [],
  )
