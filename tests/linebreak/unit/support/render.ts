import type { Line } from "@linebreak/layout/breaker"
import type { LineFit } from "@linebreak/layout/expansion"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import {
  type RenderedLayout,
  renderLines,
  tightenOverset,
} from "@linebreak/dom/render"

export const TEXT = "alpha beta gamma delta epsilon zeta eta theta"

export type Node = {
  readonly tag: string
  readonly style: Record<string, string>
  readonly dataset: Record<string, string>
  readonly children: Node[]
  readonly measured: { width: number; calls: number }
  text: string
}

const node = (
  tag: string,
  document: Document,
): Node & {
  ownerDocument: Document
  appendChild: (child: Node) => void
  append: (...children: Node[]) => void
  removeAttribute: (name: string) => void
  cloneNode: () => Node
  getBoundingClientRect: () => DOMRect
} => {
  const self = {
    tag,
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    children: [] as Node[],
    measured: { width: 0, calls: 0 },
    text: "",
    ownerDocument: document,
    getBoundingClientRect: () => {
      self.measured.calls += 1
      return { width: self.measured.width } as DOMRect
    },
    appendChild: (child: Node) => {
      self.children.push(child)
    },
    append: (...children: Node[]) => {
      self.children.push(...children)
    },
    removeAttribute: () => {},
    cloneNode: () => self,
  }
  return self
}

const fakeDocument = () => {
  const document = {
    createElement: (tag: string) => node(tag, document as unknown as Document),
    createTextNode: (text: string) => {
      const created = node("#text", document as unknown as Document)
      created.text = text
      return created
    },
    createDocumentFragment: () =>
      node("#fragment", document as unknown as Document),
  }
  return document as unknown as Document
}

const hostOf = (document: Document) => {
  const host = {
    ownerDocument: document,
    replaced: [] as Node[],
    attribute: "",
    replaceChildren: (fragment: Node) => {
      host.replaced = fragment.children
    },
    setAttribute: (_name: string, value: string) => {
      host.attribute = value
    },
  }
  return host
}

const blockFor = (text: string): ExtractedBlock => {
  const run: InlineRun = {
    kind: "text",
    text,
    start: 0,
    end: text.length,
    wrappers: [],
    sourceElement: {} as HTMLElement,
    hyphenates: false,
  }
  return { text, runs: [run], breakRestrictions: [], wrappers: new Map() }
}

const BLOCK = blockFor(TEXT)

export const lineOf = (overrides: Partial<Line> = {}): Line => ({
  start: 0,
  end: 8,
  sourceStart: 0,
  sourceEnd: TEXT.length,
  naturalWidth: 300,
  spaceCount: 7,
  stretch: 20,
  shrink: 12,
  adjustmentRatio: 0,
  breakKind: "end",
  hangStart: 0,
  hangEnd: 0,
  ...overrides,
})

const renderIn = (
  block: ExtractedBlock,
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  letterfit: RenderedLayout["letterfit"],
) => {
  const document = fakeDocument()
  const host = hostOf(document)
  const rendered = renderLines(
    host as unknown as HTMLElement,
    block,
    { lines: [line], target, fits, letterfit },
    [],
  )
  if (!rendered) throw new Error("renderLines declined")
  return (rendered as unknown as Node[])[0] as Node
}

export const render = (
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  letterfit: RenderedLayout["letterfit"] = null,
) => renderIn(BLOCK, line, target, fits, letterfit)

export const renderText = (
  text: string,
  target: number,
  letterfit: RenderedLayout["letterfit"],
) =>
  renderIn(
    blockFor(text),
    lineOf({
      sourceEnd: text.length,
      breakKind: "space",
      spaceCount: (text.trim().match(/ /g) ?? []).length,
    }),
    target,
    null,
    letterfit,
  )

export const settle = (
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
  realized: number,
  letterfit: RenderedLayout["letterfit"] = null,
) => {
  const span = renderIn(BLOCK, line, target, fits, letterfit)
  span.measured.width = realized
  const tightened = tightenOverset([
    {
      elements: [span as unknown as HTMLElement],
      layout: { lines: [line], target, fits, letterfit },
    },
  ])
  return { span, tightened }
}
