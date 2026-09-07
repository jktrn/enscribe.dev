import { afterEach, expect, test, vi } from "vitest"
import {
  honoursHangingMargins,
  preserveImageAttributes,
  renderLines,
  tightenOverset,
} from "@linebreak/dom/render"
import { handleCopy } from "@linebreak/dom/clipboard"
import { compileBlock } from "@linebreak/layout/compile"
import { breakParagraph } from "@linebreak/layout/breaker"
import { createMetrics } from "@linebreak/text"
import { runEdgeWidths, type InlineRun } from "@linebreak/dom/extract"
import { line, render, source } from "./support/content"
import { lineOf, renderText, settle } from "./support/render"

afterEach(() => {
  vi.restoreAllMocks()
  getSelection()!.removeAllRanges()
  document.body.replaceChildren()
})

test("a chosen WBR keeps padded whitespace anchors on their authored sides", () => {
  const { host, block } = source('<span style="white-space:nowrap">alpha<i id="before" style="padding-inline-start:2px;padding-inline-end:2px"> </i><wbr><b id="after" style="padding-inline-start:3px;padding-inline-end:3px"> </b>beta</span>')
  const metrics = createMetrics({ measure: (text) => text.length * 10 })
  const compiled = compileBlock({ block, locale: "en", baseFont: metrics.font,
    metricsFor: () => metrics, edgesFor: (run: InlineRun) => runEdgeWidths(block, run) })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("No anchored WBR layout")
  expect(layout.lines.map(({ naturalWidth }) => naturalWidth)).toEqual([54, 46])
  const rendered = render(host, block, layout.lines)!
  expect(rendered).toHaveLength(2)
  expect(rendered[0]!.querySelector("#before")).not.toBeNull()
  expect(rendered[0]!.querySelector("#after")).toBeNull()
  expect(rendered[1]!.querySelector("#after")).not.toBeNull()
  expect(host.querySelectorAll("#before")).toHaveLength(1)
  expect(host.querySelectorAll("#after")).toHaveLength(1)
  expect(host.textContent).toBe("alpha beta")
})

test.each([
  ['<i id="blank" style="padding-inline-start:3px;padding-inline-end:3px"> </i>\u00ad<br>beta', 0],
  ['\u00ad<i id="blank" style="padding-inline-start:3px;padding-inline-end:3px"> </i><br>beta', 0],
  ['alpha<br>\u00ad<i id="blank" style="padding-inline-start:3px;padding-inline-end:3px"> </i><br>beta', 1],
  ['alpha<br><i id="blank" style="padding-inline-start:3px;padding-inline-end:3px"> </i>\u00ad<br>beta', 1],
] as const)("invisible source on an authored blank line retains its padded wrapper: %s", (html, owner) => {
  const { host, block } = source(html)
  const metrics = createMetrics({ measure: (text) => text.replace(/\u00ad/gu, "").length * 10 })
  const compiled = compileBlock({ block, locale: "en", baseFont: metrics.font,
    metricsFor: () => metrics, edgesFor: (run: InlineRun) => runEdgeWidths(block, run) })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("No authored blank-line layout")
  expect(layout.lines[owner]!.naturalWidth).toBe(6)
  const rendered = render(host, block, layout.lines)!
  expect(rendered[owner]!.querySelector("#blank")).not.toBeNull()
  expect(rendered[owner]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[owner]!.textContent).toBe("\u00ad")
  expect(host.querySelectorAll("#blank")).toHaveLength(1)
})

test("a WBR chosen after collapsed whitespace retains that space in rendered and copied text", () => {
  const { host, block } = source('<span style="white-space:nowrap">alpha <wbr id="chosen"> beta</span>')
  const metrics = createMetrics({ measure: (text) => text.length * 10 })
  const compiled = compileBlock({ block, locale: "en", baseFont: metrics.font, metricsFor: () => metrics })
  if (!compiled.ok) throw new Error(compiled.reason)
  const layout = breakParagraph(compiled.items, 60)
  if (!layout.ok) throw new Error("No WBR layout")
  expect(layout.lines.map(({ sourceEnd, breakKind }) => [sourceEnd, breakKind])).toEqual([[6, "space"], [10, "end"]])
  expect(layout.lines.map(({ naturalWidth }) => naturalWidth)).toEqual([50, 40])
  expect(render(host, block, layout.lines)).toHaveLength(2)
  expect(host.textContent).toBe("alpha beta")
  expect(host.querySelectorAll("#chosen")).toHaveLength(1)
  // Supply the browser's inline span default and the package's line CSS;
  // Happy DOM otherwise reports an empty display value to the copy walker.
  for (const span of host.querySelectorAll("span")) span.style.display = "inline"
  for (const marker of host.querySelectorAll<HTMLElement>("[data-linebreak-opportunity]")) marker.style.display = "none"
  const selection = getSelection()!
  const range = document.createRange()
  range.selectNodeContents(host)
  selection.addRange(range)
  const event = new ClipboardEvent("copy", { clipboardData: new DataTransfer(), cancelable: true })
  handleCopy(event)
  expect(event.clipboardData!.getData("text/plain")).toBe("alpha beta")
})

test("ASCII tracking avoids grapheme segmentation while Unicode uses it", () => {
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment")
  const tracking = { lines: [{ gain: 4, shrink: 0 }], inherited: 0 }
  expect(renderText("ab cd", 310, tracking).style.letterSpacing).toBe("1px")
  expect(segment).not.toHaveBeenCalled()
  expect(renderText("a\u0301b", 310, tracking).style.letterSpacing).toBe("2px")
  expect(segment).toHaveBeenCalledExactlyOnceWith("a\u0301b")
})

test("disabled tracking does not segment Unicode text", () => {
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment")
  expect(renderText("a\u0301b", 310, null).style.letterSpacing).toBe("")
  expect(segment).not.toHaveBeenCalled()
})

test("a tracked authored blank line acquires neither invalid spacing nor adjustment markers", () => {
  const { host, block } = source("<br>")
  const rendered = renderLines(host, block, {
    lines: [{ ...line(0, 0, "forced"), naturalWidth: 0, spaceCount: 0, shrink: 0 }],
    target: 100, fits: null,
    letterfit: { lines: [{ gain: 0, shrink: 0 }], inherited: 0 },
  }, [])!
  expect(rendered[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[0]!.getAttribute("style")).toBeNull()
  expect(rendered[0]!.hasAttribute("data-linebreak-letter-fit")).toBe(false)
  expect(rendered[0]!.hasAttribute("data-linebreak-word-fit")).toBe(false)
})

test("rendering a later tracked interval excludes atoms before its source start", () => {
  const { host, block } = source('<img id="earlier">ab')
  const rendered = renderLines(host, block, {
    lines: [{ ...line(1, 3), spaceCount: 0 }], target: 200, fits: null,
    letterfit: { lines: [{ gain: 4, shrink: 0 }], inherited: 0 },
  }, [])!
  expect(rendered[0]!.style.letterSpacing).toBe("2px")
  expect(rendered[0]!.textContent).toBe("ab")
  expect(rendered[0]!.querySelector("img")).toBeNull()
})

test("unprotruded lines carry no inline opening-margin override", () => {
  const { host, block } = source("alpha")
  const rendered = render(host, block, [line(0, 5)])!
  expect(rendered[0]!.style.marginInlineStart).toBe("")
})

test("image attribute preservation skips DOM discovery when no attributes were requested", () => {
  const original = document.createElement("p")
  const replacement = document.createDocumentFragment()
  const from = vi.spyOn(original, "querySelectorAll")
  const into = vi.spyOn(replacement, "querySelectorAll")
  preserveImageAttributes(original, replacement, [])
  expect(from).not.toHaveBeenCalled()
  expect(into).not.toHaveBeenCalled()
})

test("a changed image count does not apply original attributes to the wrong replacement", () => {
  const original = document.createElement("p")
  original.innerHTML = '<img data-loaded="first"><img data-loaded="second">'
  const replacement = document.createElement("p")
  replacement.innerHTML = '<img data-loaded="replacement">'
  preserveImageAttributes(original, replacement, ["data-loaded"])
  expect(replacement.querySelector("img")!.getAttribute("data-loaded")).toBe("replacement")
})

test("rendering preserves requested live image attributes across an older source snapshot", () => {
  const { host, block } = source('a<img data-loaded="old">b')
  host.innerHTML = 'a<img data-loaded="current">b'
  renderLines(host, block, { lines: [line(0, block.text.length)], target: 100, fits: null, letterfit: null }, ["data-loaded"])
  expect(host.querySelector("img")!.getAttribute("data-loaded")).toBe("current")
})

test("a document without a root can recheck hanging support after its root is installed", () => {
  const doc = document.implementation.createHTMLDocument()
  doc.documentElement.remove()
  expect(honoursHangingMargins(doc)).toBe(false)
  const html = doc.createElement("html")
  const body = doc.createElement("body")
  html.append(body)
  doc.append(html)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, this.localName === "span" ? 216 : 200, 20)
  })
  expect(honoursHangingMargins(doc)).toBe(true)
})

test("partial fit arrays leave absent entries alone", () => {
  for (const layout of [
    { fits: [], letterfit: null },
    { fits: null, letterfit: { lines: [], inherited: 0 } },
  ]) {
    const element = document.createElement("span")
    const measure = vi.spyOn(element, "getBoundingClientRect")
    expect(tightenOverset([{ elements: [element], layout: { lines: [lineOf()], target: 300, ...layout } }])).toBe(0)
    expect(measure).not.toHaveBeenCalled()
  }
})

test("unadjusted layouts avoid reading their line elements", () => {
  let reads = 0
  const written = {
    layout: { lines: [lineOf()], target: 300, fits: null, letterfit: null },
    get elements() {
      reads += 1
      return [document.createElement("span")]
    },
  }
  expect(tightenOverset([written])).toBe(0)
  expect(reads).toBe(0)
})

test.each([undefined, "letter-spacing:0;word-spacing:0"])("ordinary fragment styles need no inline fitted override: %s", (style) => {
  const { host, block } = source(style === undefined ? "a<em>b c</em>d" : `a<em style="${style}">b c</em>d`)
  const original = host.querySelector("em")!.getAttribute("style")
  renderLines(host, block, {
    lines: [line(0, block.text.length)], target: 200, fits: null,
    letterfit: { lines: [{ gain: 6, shrink: 0 }], inherited: 0 },
  }, [])
  const fragment = host.querySelector("em")!
  expect(fragment.getAttribute("style")).toBe(original)
  expect(fragment.hasAttribute("data-linebreak-authored-style")).toBe(false)
})

test("both protruding margins are included before tightening a line", () => {
  const { span, tightened } = settle(lineOf({ naturalWidth: 300, hangStart: 3, hangEnd: 2 }), 310,
    [{ pct: 98, gain: -6, stretch: 20, shrink: 7 }], 315)
  expect(tightened).toBe(0)
  expect(span.style.wordSpacing).toBe("")
})

test("the exact overset tolerance remains unchanged", () => {
  const element = document.createElement("span")
  element.getBoundingClientRect = () => new DOMRect(0, 0, 0.05, 20)
  const result = tightenOverset([{ elements: [element], layout: {
    lines: [lineOf({ naturalWidth: 0 })], target: 0,
    fits: [{ pct: 99, gain: 0, stretch: 0, shrink: 0 }], letterfit: null,
  } }])
  expect(result).toBe(0)
  expect(element.style.wordSpacing).toBe("")
})
