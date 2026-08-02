import { describe, expect, test } from "bun:test"
import type { Line } from "@linebreak/layout/breaker"
import type { LineFit } from "@linebreak/layout/expansion"
import type { ExtractedBlock, InlineRun } from "@linebreak/dom/extract"
import { renderLines } from "@linebreak/dom/render"

const TEXT = "alpha beta gamma delta epsilon zeta eta theta"

type Node = {
  readonly tag: string
  readonly style: Record<string, string>
  readonly dataset: Record<string, string>
  readonly children: Node[]
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
} => {
  const self = {
    tag,
    style: {} as Record<string, string>,
    dataset: {} as Record<string, string>,
    children: [] as Node[],
    text: "",
    ownerDocument: document,
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

const RUN: InlineRun = {
  kind: "text",
  text: TEXT,
  start: 0,
  end: TEXT.length,
  wrappers: [],
  sourceElement: {} as HTMLElement,
  hyphenates: false,
}

const BLOCK: ExtractedBlock = {
  text: TEXT,
  runs: [RUN],
  breakRestrictions: [],
  wrappers: new Map(),
}

const lineOf = (overrides: Partial<Line> = {}): Line => ({
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

const render = (
  line: Line,
  target: number,
  fits: readonly LineFit[] | null,
) => {
  const document = fakeDocument()
  const host = hostOf(document)
  const rendered = renderLines(
    host as unknown as HTMLElement,
    BLOCK,
    { lines: [line], target, fits },
    [],
  )
  if (!rendered) throw new Error("renderLines declined")
  return (rendered as unknown as Node[])[0] as Node
}

describe("the percentage the renderer writes", () => {
  test("a line the optimizer widened is set at that percentage", () => {
    const span = render(lineOf(), 310, [{ pct: 101, gain: 3, shrink: 7 }])

    expect(span.style.fontStretch).toBe("101%")
  })

  test("a line the optimizer narrowed is set at that percentage", () => {
    const span = render(lineOf({ naturalWidth: 320 }), 310, [
      { pct: 98.5, gain: -4, shrink: 7 },
    ])

    expect(span.style.fontStretch).toBe("98.5%")
  })

  test("a line left at 100 carries no declaration at all", () => {
    const span = render(lineOf(), 310, [{ pct: 100, gain: 0, shrink: 7 }])

    expect(span.style.fontStretch).toBeUndefined()
  })

  test("a font with no width axis leaves every line alone", () => {
    const span = render(lineOf(), 310, null)

    expect(span.style.fontStretch).toBeUndefined()
  })
})

describe("the word-spacing rescue under expansion", () => {
  test("the glyphs' gain counts toward the overflow it has to absorb", () => {
    const span = render(lineOf({ naturalWidth: 300, shrink: 12 }), 301, [
      { pct: 102, gain: 7, shrink: 8 },
    ])

    expect(span.style.wordSpacing).toBe(`${-(6 / 7)}px`)
  })

  test("the spaces are charged the glue's own shrink, not the pool's", () => {
    const withPool = render(lineOf({ naturalWidth: 340, shrink: 30 }), 300, [
      { pct: 98, gain: -8, shrink: 9 },
    ])

    expect(withPool.style.wordSpacing).toBe(`${-(9 / 7)}px`)
  })

  test("a line that still fits after expanding is not squeezed", () => {
    const span = render(lineOf({ naturalWidth: 300 }), 320, [
      { pct: 101, gain: 3, shrink: 7 },
    ])

    expect(span.style.wordSpacing).toBeUndefined()
  })
})
