import { afterEach, expect, test, vi } from "vitest"
import { extractBlock } from "@linebreak/dom/extract"
import { createStyleReader } from "@linebreak/dom/style"

const iframe = () => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  const doc = frame.contentDocument!
  const view = doc.defaultView!
  return { doc, view }
}
const read = (element: Element) => {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element)
  return new Proxy(style, {
    get(target, property) {
      if (property === "whiteSpaceCollapse") return "collapse"
      if (property === "textWrapMode") return "wrap"
      if (property === "display") return style.display || "inline"
      return Reflect.get(target, property)
    },
  })
}
afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

test("same-origin iframe inline markup is extracted as text", () => {
  const { doc } = iframe()
  const p = doc.createElement("p")
  p.innerHTML = "<em>alpha beta</em>"
  doc.body.append(p)
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.text).toBe("alpha beta")
  expect(result.block.runs.map((run) => run.kind)).toEqual(["text"])
})

test.each([
  false,
  true,
])("iframe inputs preserve the disabled=%s content policy", (disabled) => {
  const { doc } = iframe()
  const p = doc.createElement("p")
  const input = doc.createElement("input")
  input.disabled = disabled
  p.append("alpha ", input, " beta")
  doc.body.append(p)
  const result = extractBlock(p, read)
  if (disabled) {
    if (!result.ok) throw new Error(result.reason)
    expect(result.block.text).toBe("alpha \ufffc beta")
  } else expect(result).toEqual({ ok: false, reason: "unsupported-content" })
})

test("style snapshots use and cache the element's own window", () => {
  const { doc, view } = iframe()
  const p = doc.createElement("p")
  const em = doc.createElement("em")
  em.style.fontFamily = "monospace"
  p.append(em)
  doc.body.append(p)
  const styleOf = createStyleReader(p, view.getComputedStyle(p))
  const own = vi.spyOn(view, "getComputedStyle")
  expect(styleOf(em).fontFamily).toBe("monospace")
  expect(styleOf(em)).toBe(styleOf(em))
  expect(own).toHaveBeenCalledTimes(1)
  expect(own).toHaveBeenCalledWith(em)
})

test("detached HTML documents without a window still have a style reader", () => {
  const doc = document.implementation.createHTMLDocument()
  expect(doc.defaultView).toBeNull()
  const p = doc.createElement("p")
  const em = doc.createElement("em")
  em.style.fontFamily = "monospace"
  p.append(em)
  doc.body.append(p)
  const styleOf = createStyleReader(p, getComputedStyle(p))
  expect(styleOf(em).fontFamily).toBe("monospace")
})

test.each([
  "br",
  "wbr",
  "input",
])("a foreign inline %s element cannot acquire HTML break or form-control semantics", (name) => {
  const p = document.createElement("p")
  const foreign = document.createElementNS("http://www.w3.org/2000/svg", name)
  foreign.style.display = "inline"
  p.append("alpha", foreign, "beta")
  document.body.append(p)
  const result = extractBlock(p, read)
  if (!result.ok) throw new Error(result.reason)
  expect(result.block.text).toBe("alpha\ufffcbeta")
  expect(result.block.runs.map((run) => run.kind)).toEqual([
    "text",
    "atom",
    "text",
  ])
})

test("a foreign block named img cannot bypass the block-content restriction", () => {
  const p = document.createElement("p")
  const foreign = document.createElementNS("http://www.w3.org/2000/svg", "img")
  foreign.style.display = "block"
  p.append("alpha", foreign, "beta")
  document.body.append(p)
  expect(extractBlock(p, read)).toEqual({
    ok: false,
    reason: "unsupported-content",
  })
})
