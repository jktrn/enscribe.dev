import { afterEach, describe, expect, test, vi } from "vitest"
import { handleCopy } from "@linebreak/dom/clipboard"
import { proseBlocks } from "@linebreak/dom/discover"
import {
  contentWidth,
  layoutMismatch,
  resolvedLineHeight,
  styleOf,
} from "@linebreak/dom/geometry"
import { captureAuthored, restoreAuthored } from "@linebreak/dom/restore"
import {
  computedFont,
  createStyleReader,
  firstLineIndent,
  unmodellableProperty,
} from "@linebreak/dom/style"
import {
  honoursHangingMargins,
  preserveImageAttributes,
} from "@linebreak/dom/render"
import { consoleReporter } from "@linebreak/report"

afterEach(() => {
  document.body.replaceChildren()
  getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
})

const fixture = (html: string) => {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  return host
}

const copy = (element: Element) => {
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  const event = new ClipboardEvent("copy", {
    clipboardData: new DataTransfer(),
    cancelable: true,
  })
  handleCopy(event)
  return event
}

describe("copying typeset content", () => {
  test("copies authored prose with line wrappers removed and semantic markup preserved", () => {
    const host = fixture(
      '<p data-linebreak-typeset="2"><span data-linebreak-line="space" style="display:inline"><em style="display:inline" data-linebreak-fragment="yes" data-keep="yes">alpha</em></span> <span data-linebreak-line="end" style="display:inline">beta</span></p>',
    )
    const event = copy(host)
    expect(event.defaultPrevented).toBe(true)
    expect(event.clipboardData?.getData("text/plain")).toBe("alpha beta\n")
    const html = event.clipboardData?.getData("text/html") ?? ""
    expect(html).toContain("<em")
    expect(html).toContain('data-keep="yes"')
    expect(html).not.toContain("data-linebreak")
    const clean = document.createElement("div")
    clean.innerHTML = html
    expect(clean.querySelectorAll("span")).toHaveLength(0)
  })

  test("ignores no selection, missing clipboard data, and ordinary untypeset text", () => {
    const empty = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      cancelable: true,
    })
    handleCopy(empty)
    expect(empty.defaultPrevented).toBe(false)
    const host = fixture("ordinary text")
    expect(copy(host).defaultPrevented).toBe(false)
    const noData = new ClipboardEvent("copy", { cancelable: true })
    handleCopy(noData)
    expect(noData.defaultPrevented).toBe(false)
  })

  test("retains authored hard breaks and hides invisible content", () => {
    const host = fixture(
      '<p data-linebreak-typeset="2"><span data-linebreak-line="forced" style="display:inline">alpha</span><br><span style="display:none">secret</span><!--comment--><span data-linebreak-line="end" style="display:inline">beta</span></p>',
    )
    expect(copy(host).clipboardData?.getData("text/plain")).toBe(
      "alpha\nbeta\n",
    )
  })

  test("does not intercept a selection entirely inside one line", () => {
    const host = fixture(
      '<p data-linebreak-typeset="1"><span data-linebreak-line="end">alpha beta</span></p>',
    )
    expect(copy(host.querySelector("span")!).defaultPrevented).toBe(false)
  })

  test("clips partial endpoints while preserving complete selected line wrappers", () => {
    const host = fixture(
      '<span style="display:inline">prefix</span><span data-linebreak-line="end" style="display:inline">middle</span><span style="display:inline">suffix</span>',
    )
    const range = document.createRange()
    range.setStart(host.firstElementChild!.firstChild!, 3)
    range.setEnd(host.lastElementChild!.firstChild!, 3)
    getSelection()!.addRange(range)
    const event = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      cancelable: true,
    })
    handleCopy(event)
    expect(event.clipboardData?.getData("text/plain")).toBe("fixmiddlesuf")
  })

  test("math and ruby contents do not introduce spurious paragraph breaks", () => {
    const host = fixture(
      '<span data-linebreak-line="end" style="display:inline"><math><mrow>x</mrow></math><ruby>a<rt>b</rt></ruby></span>',
    )
    expect(copy(host).clipboardData?.getData("text/plain")).toBe("xab")
  })

  test("ignores unselected siblings and declines a text-node-only selection", () => {
    const host = fixture(
      '<span>outside</span><span data-linebreak-line="end" style="display:inline">inside</span><span>outside</span>',
    )
    const range = document.createRange()
    range.setStart(host, 1)
    range.setEnd(host, 2)
    getSelection()!.addRange(range)
    const event = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      cancelable: true,
    })
    handleCopy(event)
    expect(event.clipboardData?.getData("text/plain")).toBe("inside")
    getSelection()!.removeAllRanges()
    const textRange = document.createRange()
    textRange.selectNodeContents(host.childNodes[1]!.firstChild!)
    getSelection()!.addRange(textRange)
    const textEvent = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      cancelable: true,
    })
    handleCopy(textEvent)
    expect(textEvent.defaultPrevented).toBe(false)
  })
})

describe("discovering prose blocks", () => {
  test("chooses leaf blocks, skips code and authored exclusions, and honors filters", () => {
    const host = fixture(
      '<article><p id="a">alpha <em style="display:inline">text</em></p><section><p id="b">beta</p></section><pre>code</pre><p data-linebreak-skip>skip</p><p id="empty"> </p></article>',
    )
    expect(proseBlocks(host).map((node) => node.id)).toEqual(["a", "b"])
    expect(
      proseBlocks(host, { skip: "#a", filter: (node) => node.id === "b" }).map(
        (node) => node.id,
      ),
    ).toEqual(["b"])
    expect(proseBlocks(host, { filter: () => false })).toEqual([])
  })

  test("treats CSS inline, hidden, and contents as inline children", () => {
    const host = fixture(
      '<p>alpha<span style="display:none">hidden</span><span style="display:contents">contents</span><span style="display:inline-flex">widget</span><span style="display:inline">inline</span></p>',
    )
    expect(proseBlocks(host)).toEqual([host.querySelector("p")])
  })

  test("does not report non-HTML elements as paragraphs", () => {
    const element = document.createElementNS("urn:test", "prose")
    element.textContent = "alpha"
    expect(proseBlocks(element)).toEqual([])
  })

  test.each([
    "math",
    "ruby",
    "ruby-base",
    "ruby-base-container",
    "ruby-text",
    "ruby-text-container",
  ])("keeps %s boxes within their containing paragraph", (display) => {
    const host = fixture("<p>alpha<span>annotation</span>beta</p>")
    const inline = host.querySelector("span")!
    const read = getComputedStyle.bind(globalThis)
    // Happy DOM does not implement these CSS Display values yet.
    vi.spyOn(globalThis, "getComputedStyle").mockImplementation((element) => {
      const style = read(element)
      return element === inline
        ? new Proxy(style, {
            get: (target, property) =>
              property === "display" ? display : Reflect.get(target, property),
          })
        : style
    })
    expect(proseBlocks(host)).toEqual([host.querySelector("p")])
  })
})

describe("geometry and authored content", () => {
  test("content width subtracts both paddings from the client width", () => {
    const host = fixture("alpha")
    host.style.paddingInlineStart = "5px"
    host.style.paddingInlineEnd = "7px"
    Object.defineProperty(host, "clientWidth", { value: 100 })
    expect(contentWidth(host, styleOf(host))).toBe(88)
  })

  test("line height uses explicit pixels, the normal fallback, or NaN without a font", () => {
    const style = document.createElement("span").style
    style.lineHeight = "24px"
    expect(resolvedLineHeight(style)).toBe(24)
    style.lineHeight = "normal"
    style.fontSize = "20px"
    expect(resolvedLineHeight(style)).toBe(24)
    style.fontSize = ""
    expect(resolvedLineHeight(style)).toBeNaN()
  })

  test("detached documents use the ambient view and malformed percentage indents contribute zero", () => {
    const doc = document.implementation.createHTMLDocument()
    Object.defineProperty(doc, "defaultView", { value: null })
    const detached = doc.createElement("p")
    const fallback = document.createElement("p").style
    fallback.fontSize = "23px"
    vi.spyOn(globalThis, "getComputedStyle").mockReturnValueOnce(fallback)
    expect(styleOf(detached).fontSize).toBe("23px")
    const style = new Proxy(document.createElement("span").style, {
      get: (target, property) =>
        property === "textIndent" ? "invalid%" : Reflect.get(target, property),
    })
    expect(firstLineIndent(style, 100)).toBe(0)
  })

  test("detects missing lines, collapsed lines, duplicate rows, and excess horizontal overflow", () => {
    const host = fixture(
      "<span data-linebreak-line>first</span><span data-linebreak-line>second</span>",
    )
    const [first, second] = [...host.children]
    Object.defineProperties(host, {
      clientWidth: { value: 100 },
      scrollWidth: { value: 103 },
    })
    expect(layoutMismatch(host, 1, 0)).toBe(true)
    expect(layoutMismatch(host, 2, 0)).toBe(true)
    first!.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20)
    second!.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20)
    expect(layoutMismatch(host, 2, 0)).toBe(true)
    second!.getBoundingClientRect = () => new DOMRect(0, 20, 100, 20)
    expect(layoutMismatch(host, 2, 0)).toBe(true)
    expect(layoutMismatch(host, 2, 2)).toBe(false)
  })

  test("captures reusable authored clones and preserves live image loading attributes on restore", () => {
    const host = fixture(
      '<p> alpha  <em>beta</em><img src="first.png" loading="lazy" decoding="sync"></p>',
    )
    const p = host.querySelector("p")!
    const authored = captureAuthored(p)
    expect(p.textContent).toBe(" alpha  beta")
    p.setAttribute("data-linebreak-typeset", "1")
    p.innerHTML =
      '<span data-linebreak-line>changed<img src="second.png" decoding="async"></span>'
    restoreAuthored(p, authored, ["src", "loading", "decoding"])
    expect(p.hasAttribute("data-linebreak-typeset")).toBe(false)
    expect(p.textContent).toBe(" alpha  beta")
    expect(p.querySelector("img")?.getAttribute("src")).toBe("second.png")
    expect(p.querySelector("img")?.hasAttribute("loading")).toBe(false)
    expect(p.querySelector("img")?.getAttribute("decoding")).toBe("async")
    expect(authored.querySelector("img")?.getAttribute("src")).toBe("first.png")
    p.textContent = "authored edit"
    restoreAuthored(p, authored, [])
    expect(p.textContent).toBe("authored edit")
  })

  test("image attributes are not paired when image counts differ", () => {
    const original = fixture('<img src="original.png">')
    const replacement = document.createDocumentFragment()
    preserveImageAttributes(original, replacement, ["src"])
    expect(replacement.childNodes).toHaveLength(0)
  })

  test("style readers cache per element and use the supplied root style", () => {
    const host = fixture('<span style="font-size:14px">child</span>')
    const supplied = document.createElement("div").style
    const getStyle = vi.spyOn(globalThis, "getComputedStyle")
    const reader = createStyleReader(host, supplied)
    expect(reader(host)).toBe(supplied)
    const child = host.firstElementChild!
    expect(reader(child)).toBe(reader(child))
    expect(getStyle).toHaveBeenCalledTimes(1)
    expect(
      computedFont({ ...supplied, font: "16px serif" } as CSSStyleDeclaration),
    ).toBe("16px serif")
    supplied.fontStyle = "italic"
    supplied.fontSize = "16px"
    supplied.fontFamily = "serif"
    const withoutShorthand = new Proxy(supplied, {
      get: (target, property) =>
        property === "font" ? "" : Reflect.get(target, property),
    })
    expect(computedFont(withoutShorthand)).toBe("italic 16px serif")
  })

  test("hanging-margin capability probes cache measured support", () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return new DOMRect(
          0,
          0,
          this.style.marginInlineEnd === "-16px" ? 216 : 200,
          16,
        )
      })
    const doc = document.implementation.createHTMLDocument()
    expect(honoursHangingMargins(doc)).toBe(true)
    const calls = spy.mock.calls.length
    expect(honoursHangingMargins(doc)).toBe(true)
    expect(spy.mock.calls).toHaveLength(calls)
    doc.body.remove()
    const empty = document.implementation.createHTMLDocument()
    empty.documentElement.remove()
    expect(honoursHangingMargins(empty)).toBe(false)
  })

  test.each([
    [15.49, false],
    [15.5, true],
    [16, true],
  ] as const)("hanging-margin capability uses relative edges and a half-pixel tolerance (%s)", (reach, supported) => {
    const doc = document.implementation.createHTMLDocument()
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        expect(this.isConnected).toBe(true)
        if (this.style.marginInlineEnd === "-16px") {
          expect(this.style.display).toBe("inline")
          expect(this.style.whiteSpace).toBe("nowrap")
          expect(this.textContent).toBe("aaa bbb ccc ddd")
          expect(this.nextSibling?.textContent).toBe(" ")
          expect(this.nextElementSibling?.textContent).toBe(
            "eeeeeeeeeeeeeeeeeeeeeeee",
          )
          return new DOMRect(70, 0, 200 + reach, 16)
        }
        expect(this.style.width).toBe("200px")
        expect(this.style.textAlign).toBe("justify")
        expect(this.style.textAlignLast).toBe("start")
        return new DOMRect(70, 0, 200, 16)
      })
    expect(honoursHangingMargins(doc)).toBe(supported)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(doc.body.childNodes).toHaveLength(0)
    expect(honoursHangingMargins(doc)).toBe(supported)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  test("reporting all outcomes includes success while failed-only ignores declines", () => {
    const element = fixture("alpha")
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const all = consoleReporter({ level: "all", prefix: "test" })
    all({ element, status: "typeset", lines: 2, retries: 0 })
    expect(info).toHaveBeenCalledWith("test: typeset 2 lines", element)
    const failed = consoleReporter({ level: "failed" })
    failed({ element, status: "declined", reason: "unsupported-content" })
    expect(debug).not.toHaveBeenCalled()
    failed({ element, status: "failed", reason: "render-failed" })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test("default reporting distinguishes expected outcomes, declines, and failures", () => {
    const element = fixture("alpha")
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const report = consoleReporter()
    report({ element, status: "typeset", lines: 2, retries: 0 })
    report({ element, status: "declined", reason: "unsupported-content" })
    report({ element, status: "failed", reason: "render-failed" })
    expect(info).not.toHaveBeenCalled()
    expect(debug).toHaveBeenCalledExactlyOnceWith(
      "linebreak: declined (unsupported-content)",
      element,
    )
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "linebreak: failed (render-failed)",
      element,
    )
  })

  test("an omitted text transform is neutral while authored case transforms are declined", () => {
    const style = document.createElement("span").style
    expect(style.textTransform).toBe("")
    expect(unmodellableProperty(style)).toBeNull()
    style.textTransform = "none"
    expect(unmodellableProperty(style)).toBeNull()
    style.textTransform = "uppercase"
    expect(unmodellableProperty(style)).toBe("text-transform")
  })
})

test("line geometry rejects missing or duplicate rows without relying on overflow", () => {
  const host = fixture(
    "<span data-linebreak-line>one</span><span data-linebreak-line>two</span>",
  )
  Object.defineProperties(host, {
    clientWidth: { value: 100 },
    scrollWidth: { value: 100 },
  })
  const first = host.children[0] as HTMLElement
  const second = host.children[1] as HTMLElement
  first.getBoundingClientRect = () => new DOMRect(0, 0, 40, 20)
  second.getBoundingClientRect = () => new DOMRect(0, 20, 0, 0)
  expect(layoutMismatch(host, 1, 0)).toBe(true)
  expect(layoutMismatch(host, 2, 0)).toBe(true)
  second.getBoundingClientRect = () => new DOMRect(0, 20, 0, 20)
  expect(layoutMismatch(host, 2, 0)).toBe(false)
  second.getBoundingClientRect = () => new DOMRect(0, 20, 20, 0)
  expect(layoutMismatch(host, 2, 0)).toBe(false)
  second.getBoundingClientRect = () => new DOMRect(0, 0, 40, 20)
  expect(layoutMismatch(host, 2, 0)).toBe(true)
})

test("copy keeps block boundaries, consecutive BRs, empty blocks, and inline contents distinct", () => {
  const host = fixture(
    '<div></div><br><p data-linebreak-typeset="2"><span data-linebreak-line="forced" style="display:inline-flex"><span style="display:contents">alpha</span><br><br></span><span data-linebreak-line="end" style="display:inline">beta</span></p><p>gamma</p>',
  )
  expect(copy(host).clipboardData?.getData("text/plain")).toBe(
    "\nalpha\n\nbeta\ngamma\n",
  )
})

test("ordinary copy avoids cloning unrelated DOM and declines document-wide selections", () => {
  const host = fixture("ordinary text")
  const clone = vi.spyOn(Range.prototype, "cloneContents")
  expect(copy(host).defaultPrevented).toBe(false)
  expect(clone).not.toHaveBeenCalled()
  const range = document.createRange()
  range.selectNodeContents(document)
  getSelection()!.removeAllRanges()
  getSelection()!.addRange(range)
  const event = new ClipboardEvent("copy", {
    clipboardData: new DataTransfer(),
    cancelable: true,
  })
  expect(() => handleCopy(event)).not.toThrow()
  expect(event.defaultPrevented).toBe(false)
})

test("copy separates inline text from following blocks and retains clipped endpoints", () => {
  const host = fixture(
    '<span data-linebreak-line="end" style="display:inline">alpha</span><div><span style="display:inline">beta</span></div><span style="display:inline">gamma</span>',
  )
  expect(copy(host).clipboardData?.getData("text/plain")).toBe(
    "alpha\nbeta\ngamma",
  )
  const range = document.createRange()
  range.setStart(host.firstChild!.firstChild!, 2)
  range.setEnd(host.lastChild!.firstChild!, 3)
  getSelection()!.removeAllRanges()
  getSelection()!.addRange(range)
  const event = new ClipboardEvent("copy", {
    clipboardData: new DataTransfer(),
    cancelable: true,
  })
  handleCopy(event)
  expect(event.clipboardData?.getData("text/plain")).toBe("pha\nbeta\ngam")
})

test("copy keeps inline-block children on the same text line", () => {
  const host = fixture(
    '<span data-linebreak-line="end" style="display:inline">alpha<span style="display:inline-block">beta</span>gamma</span>',
  )
  expect(copy(host).clipboardData?.getData("text/plain")).toBe("alphabetagamma")
})

test("copying an ordinary fragment never invents an authored style declaration", () => {
  const host = fixture(
    '<span data-linebreak-line="end" style="display:inline"><em id="author" class="quiet" data-linebreak-fragment>alpha</em></span>',
  )
  expect(copy(host).clipboardData?.getData("text/html")).toBe(
    '<em id="author" class="quiet">alpha</em>',
  )
})
