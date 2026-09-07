import { afterEach, expect, test } from "vitest"
import { appendLine, trimmedSlice } from "@linebreak/dom/render-content"
import { line, render, source } from "./support/content"

afterEach(() => document.body.replaceChildren())

test("a later interval skips earlier optional breaks but retains its boundary marker", () => {
  const { block } = source('<wbr id="earlier">alpha<wbr id="boundary">beta')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(5, 9), 0)).not.toBeNull()
  expect(target.textContent).toBe("beta")
  expect(target.querySelector("#earlier")).toBeNull()
  expect(target.querySelector("#boundary")).not.toBeNull()
})

test("a trailing anchor cannot supply content for an empty later interval", () => {
  const { block } = source('alpha<i id="gap"> </i>')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(5, 5), 0)).toBeNull()
  expect(target.textContent).toBe("")
  expect(target.querySelector("#gap")).toBeNull()
})

test("a nonempty forced source slice excludes an earlier trailing anchor", () => {
  const { block } = source('alpha <i id="earlier" style="padding-inline:3px"> </i>beta')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(5, 10, "forced"), 0)).not.toBeNull()
  expect(target.textContent).toBe("beta")
  expect(target.querySelector("#earlier")).toBeNull()
  expect(target.querySelectorAll("br")).toHaveLength(1)
})

test("a next-affinity anchor at the interval start stays with following content", () => {
  const { block } = source('alpha<br><i id="next"> </i>beta')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(6, 10), 0)).not.toBeNull()
  expect(target.textContent).toBe("beta")
  expect(target.querySelector("#next")).not.toBeNull()
})

test("a later interval skips next-affinity anchors before its source start", () => {
  const { block } = source('<i id="leading"> </i>alpha beta')
  const target = document.createElement("span")
  expect(appendLine(target, block, line(6, 10), 0)).not.toBeNull()
  expect(target.textContent).toBe("beta")
  expect(target.querySelector("#leading")).toBeNull()
  expect(target.childNodes).toHaveLength(1)
  expect(target.firstChild!.nodeName).toBe("#text")
})

test("a next-affinity anchor at an authored break belongs to the following line", () => {
  const { host, block } = source('alpha<br><i id="next"> </i>beta')
  const rendered = render(host, block, [line(0, 5, "forced"), line(6, 10)])!
  expect(rendered[0]!.querySelector("#next")).toBeNull()
  expect(rendered[1]!.querySelector("#next")).not.toBeNull()
  expect(host.querySelectorAll("#next")).toHaveLength(1)
})

test("an anchor after a chosen space cannot move onto the preceding line", () => {
  const { host, block } = source('alpha beta<i id="later"> </i>gamma')
  const rendered = render(host, block, [line(0, 5, "space"), line(6, 16)])!
  expect(rendered[0]!.querySelector("#later")).toBeNull()
  expect(rendered[1]!.querySelector("#later")).not.toBeNull()
})

test("an optional break cannot suppress a required authored line ending", () => {
  const { host, block } = source('alpha<wbr id="optional"> beta')
  const rendered = render(host, block, [line(0, 5, "forced"), line(6, 10)])!
  expect(rendered[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[0]!.querySelector("#optional")!.hasAttribute("data-linebreak-opportunity")).toBe(true)
})

test("a planned forced boundary after an atom receives its physical line ending", () => {
  const { host, block } = source('<img id="atom">beta')
  const rendered = render(host, block, [line(0, 1, "forced"), line(1, 5)])!
  expect(rendered[0]!.querySelector("#atom")).not.toBeNull()
  expect(rendered[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[1]!.textContent).toBe("beta")
})

test("an anchor-only forced slice receives a line ending before following text", () => {
  const { host, block } = source('<i id="anchor" style="padding-inline:3px"> </i>beta')
  const rendered = render(host, block, [line(0, 0, "forced"), line(0, 4)])!
  expect(rendered[0]!.querySelector("#anchor")).not.toBeNull()
  expect(rendered[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(rendered[1]!.textContent).toBe("beta")
  expect(host.querySelectorAll("#anchor")).toHaveLength(1)
})

test("authored BR elements remain visible while WBR opportunities are hidden", () => {
  const { host, block } = source('alpha<wbr id="optional"><br id="forced">beta')
  const rendered = render(host, block, [line(0, 5, "forced"), line(6, 10)])!
  expect(rendered[0]!.querySelector("#optional")!.hasAttribute("data-linebreak-opportunity")).toBe(true)
  expect(rendered[0]!.querySelector("#forced")!.hasAttribute("data-linebreak-opportunity")).toBe(false)
})

test("an atomic subtree retains its descendants and their attributes", () => {
  const { host, block } = source('a<span data-linebreak-atom><b title="nested">value</b></span>b')
  const original = host.querySelector("b")!
  render(host, block, [line(0, block.text.length)])
  expect(host.querySelector("b")!.outerHTML).toBe(original.outerHTML)
  expect(host.querySelector("b")).not.toBe(original)
  expect(host.textContent).toBe("avalueb")
})

test("missing outer metadata declines nested content without changing the host", () => {
  const { host, block } = source('<em><strong>alpha</strong></em>')
  block.wrappers.delete(host.querySelector("em")!)
  expect(render(host, block, [line(0, 5)])).toBeNull()
  expect(host.innerHTML).toBe('<em><strong>alpha</strong></em>')
})

test("a wrapper ending one character after a WBR keeps its trailing decoration on the next line", () => {
  const { host, block } = source('<em id="split">alpha<wbr>Z<i data-linebreak-decoration data-linebreak-decoration-position="after" aria-hidden="true">trail</i></em>beta')
  const rendered = render(host, block, [line(0, 5, "none"), line(5, 10)])!
  expect(rendered[0]!.querySelector("em")!.hasAttribute("data-linebreak-fragment-end")).toBe(false)
  expect(rendered[0]!.textContent).toBe("alpha")
  expect(rendered[1]!.textContent).toBe("Ztrailbeta")
  expect(host.querySelectorAll("[data-linebreak-decoration]")).toHaveLength(1)
})

test("a later whitespace-leading wrapper stays out of an earlier hyphenated word", () => {
  const { host, block } = source('<span>alphabet</span><em id="later"> beta</em>')
  const rendered = render(host, block, [line(0, 5, "hyphen"), line(5, 13)])!
  expect(rendered[0]!.textContent).toBe("alpha")
  expect(rendered[0]!.querySelector("em")).toBeNull()
  expect(rendered[1]!.querySelector("em")!.textContent).toBe(" beta")
  expect(host.querySelectorAll("#later")).toHaveLength(1)
})

test("a fully consumed text run advances the cursor exactly once", () => {
  const { block } = source('<em>alpha</em> beta')
  const first = document.createElement("span")
  expect(appendLine(first, block, line(0, 5, "space"), 0)).toEqual({ nextRun: 1 })
  expect(first.childNodes).toHaveLength(1)
  expect(first.firstChild!.nodeName).toBe("EM")
  const second = document.createElement("span")
  expect(appendLine(second, block, line(6, 10), 1)).toEqual({ nextRun: 2 })
  expect(second.textContent).toBe("beta")
})

test("partially consumed text remains available to subsequent lines", () => {
  const { block } = source("alpha beta")
  const target = document.createElement("span")
  expect(appendLine(target, block, line(0, 5, "space"), 0)).toEqual({ nextRun: 0 })
  expect(target.textContent).toBe("alpha")
})

test("an authored break consumes its separator even when the source interval excludes it", () => {
  const { block } = source("alpha<br>beta")
  const target = document.createElement("span")
  expect(appendLine(target, block, line(0, 5, "forced"), 0)).toEqual({ nextRun: 2 })
  expect(target.querySelectorAll("br")).toHaveLength(1)
})

test("slice trimming removes normalized edge spaces and line separators", () => {
  const { block } = source("<br> alpha <br>")
  expect(trimmedSlice(block, line(0, block.text.length))).toEqual({ sliceStart: 1, sliceEnd: 6 })
})

test.each([
  ['<i id="blank" style="padding-inline:3px"> </i><br>beta', [line(0, 0, "forced"), line(1, 5)], 0],
  ['alpha<br><i id="blank" style="padding-inline:3px"> </i><br>beta', [line(0, 5, "forced"), line(6, 6, "forced"), line(7, 11)], 1],
] as const)("a whitespace wrapper before a blank authored line retains its identity: %s", (html, lines, owner) => {
  const { host, block } = source(html)
  const rendered = render(host, block, lines)!
  expect(host.querySelectorAll("#blank")).toHaveLength(1)
  expect(rendered[owner]!.querySelector("#blank")).not.toBeNull()
  expect(rendered[owner]!.querySelectorAll("br")).toHaveLength(1)
})
