import { afterEach, describe, expect, test } from "vitest"
import { appendLine } from "@linebreak/dom/render-content"
import { renderLines, tightenOverset } from "@linebreak/dom/render"
import { handleCopy } from "@linebreak/dom/clipboard"
import { line, render, source } from "./support/content"

afterEach(() => document.body.replaceChildren())

describe("rendered semantic content", () => {
  test.each([
    "letter-spacing:0!important",
    "word-spacing:0!important",
    "letter-spacing:0!important;word-spacing:0!important",
  ])("fitted fragments honor %s and copy the exact authored style", (style) => {
    const { host, block } = source(`a<em id="fit" style="${style}">b c</em>d`)
    const originalStyle = host.querySelector("em")!.getAttribute("style")
    const rendered = renderLines(
      host,
      block,
      {
        lines: [line(0, block.text.length)],
        target: 200,
        fits: null,
        letterfit: { lines: [{ gain: 6, shrink: 0 }], inherited: 0 },
      },
      [],
    )!
    const fragment = rendered[0]!.querySelector("em")!
    for (const property of ["letter-spacing", "word-spacing"]) {
      if (style.includes(property)) {
        expect(fragment.style.getPropertyValue(property)).toBe("inherit")
        expect(fragment.style.getPropertyPriority(property)).toBe("important")
      }
    }
    expect(fragment.getAttribute("data-linebreak-authored-style")).toBe(
      originalStyle,
    )
    const range = document.createRange()
    range.selectNodeContents(host)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
    const event = new ClipboardEvent("copy", {
      clipboardData: new DataTransfer(),
      cancelable: true,
    })
    handleCopy(event)
    const copied = document.createElement("div")
    copied.innerHTML = event.clipboardData!.getData("text/html")
    expect(copied.querySelector("em")!.getAttribute("style")).toBe(
      originalStyle,
    )
    expect(copied.querySelector("em")!.id).toBe("fit")
    expect(copied.textContent).toBe("ab cd")
    expect(copied.innerHTML).not.toContain("data-linebreak")
  })

  test("late overset correction reaches fragments with an authored important word spacing", () => {
    const { host, block } = source(
      'a<em style="word-spacing:0!important">b c</em>d',
    )
    const layout = {
      lines: [line(0, block.text.length)],
      target: 100,
      fits: [{ pct: 99, gain: 0, shrink: 0, stretch: 0 }],
      letterfit: null,
    }
    const rendered = renderLines(host, block, layout, [])!
    const target = rendered[0]!
    const fragment = target.querySelector("em")!
    const originalStyle = fragment.getAttribute("style")
    expect(fragment.style.wordSpacing).toBe("0px")
    expect(target.hasAttribute("data-linebreak-word-fit")).toBe(false)
    target.getBoundingClientRect = () => new DOMRect(0, 0, 102, 20)
    expect(tightenOverset([{ elements: rendered, layout }])).toBe(1)
    expect(target.style.wordSpacing).toBe("-2px")
    expect(target.hasAttribute("data-linebreak-word-fit")).toBe(true)
    expect(fragment.style.getPropertyValue("word-spacing")).toBe("inherit")
    expect(fragment.getAttribute("data-linebreak-authored-style")).toBe(
      originalStyle,
    )
  })

  test.each([
    ['alpha<wbr><em id="next">beta</em>', "beta"],
    ['alpha<wbr><em id="next"><img alt="next"></em>beta', "beta"],
  ])("a wrapper beginning at a break is only cloned on its content line: %s", (html, text) => {
    const { host, block } = source(html)
    const rendered = render(host, block, [
      line(0, 5, "none"),
      line(5, block.text.length),
    ])!
    expect(rendered[0]!.textContent).toBe("alpha")
    expect(rendered[0]!.querySelector("#next")).toBeNull()
    expect(rendered[1]!.querySelector("#next")).not.toBeNull()
    expect(rendered[1]!.textContent).toBe(text)
    expect(host.querySelectorAll("#next")).toHaveLength(1)
    expect(host.querySelectorAll("img")).toHaveLength(
      html.includes("img") ? 1 : 0,
    )
  })

  test("splits nested wrappers across lines without duplicate IDs or decorations", () => {
    const { host, block } = source(
      '<a id="link"><i data-linebreak-decoration aria-hidden="true">lead</i>alpha <em id="em">beta gamma</em> delta<i data-linebreak-decoration aria-hidden="true" data-linebreak-decoration-position="after">trail</i></a>',
    )
    const lines = render(host, block, [
      line(0, 10, "space"),
      line(11, block.text.length),
    ])!
    expect(lines).toHaveLength(2)
    expect(host.querySelectorAll("#link")).toHaveLength(1)
    expect(host.querySelectorAll("#em")).toHaveLength(1)
    expect(lines[0]?.textContent).toBe("leadalpha beta")
    expect(lines[1]?.textContent).toBe("gamma deltatrail")
    const links = [...host.querySelectorAll("a")]
    expect(links[0]?.hasAttribute("data-linebreak-fragment-start")).toBe(true)
    expect(links[0]?.hasAttribute("data-linebreak-fragment-end")).toBe(false)
    expect(links[1]?.hasAttribute("data-linebreak-fragment-start")).toBe(false)
    expect(links[1]?.hasAttribute("data-linebreak-fragment-end")).toBe(true)
  })

  test.each([
    "forced",
    "space",
    "hyphen",
    "none",
  ] as const)("separates %s lines using the authored break kind", (kind) => {
    const { host, block } = source("alpha beta")
    const rendered = render(host, block, [line(0, 5, kind), line(6, 10)])!
    expect(rendered.map((node) => node.textContent)).toEqual(["alpha", "beta"])
    const separator =
      kind === "forced" ? rendered[0]!.lastChild! : host.childNodes[1]!
    expect(separator.nodeName).toBe(
      kind === "forced" ? "BR" : kind === "space" ? "#text" : "WBR",
    )
    expect(host.getAttribute("data-linebreak-typeset")).toBe("2")
    expect(host.childNodes).toHaveLength(kind === "forced" ? 2 : 3)
  })

  test("copies atoms rather than moving authored nodes into the output", () => {
    const { host, block } = source(
      'alpha <img src="photo.png" alt="photo"> beta',
    )
    const original = host.querySelector("img")!
    const rendered = render(host, block, [line(0, block.text.length)])!
    const copied = rendered[0]!.querySelector("img")!
    expect(copied).not.toBe(original)
    expect(copied.getAttribute("src")).toBe("photo.png")
    expect(copied.getAttribute("alt")).toBe("photo")
  })

  test("retains whitespace-only wrapper anchors on the correct side of a break", () => {
    const { host, block } = source(
      '<i id="leading"> </i>alpha<i id="gap"> </i>beta<i id="trailing"> </i>',
    )
    const rendered = render(host, block, [line(0, 5, "space"), line(6, 10)])!
    expect(rendered[0]?.textContent).toBe("alpha")
    expect(rendered[1]?.textContent).toBe("beta")
    expect(host.querySelectorAll("#leading")).toHaveLength(1)
    expect(host.querySelectorAll("#trailing")).toHaveLength(1)
  })

  test("trims line-edge whitespace and advances past already consumed runs", () => {
    const { block } = source("alpha <em>beta</em> gamma")
    const target = document.createElement("span")
    const appended = appendLine(target, block, line(6, 11), 0)
    expect(target.textContent).toBe("beta")
    expect(appended?.nextRun).toBeGreaterThan(0)
    expect(target.querySelector("em")?.textContent).toBe("beta")
  })

  test("declines missing wrapper metadata without changing the host", () => {
    const { host, block } = source("<em>alpha</em>")
    const invalid = { ...block, wrappers: new Map() }
    expect(render(host, invalid, [line(0, 5)])).toBeNull()
    expect(host.innerHTML).toBe("<em>alpha</em>")
    expect(host.hasAttribute("data-linebreak-typeset")).toBe(false)
  })

  test("declines a line with no renderable content", () => {
    const { host, block } = source("alpha")
    expect(render(host, block, [line(5, 5)])).toBeNull()
    expect(host.textContent).toBe("alpha")
  })

  test("one line can transition between shared, nested, and unrelated wrappers", () => {
    const { host, block } = source(
      "<strong>alpha <em>beta</em> gamma</strong> <a>delta</a>",
    )
    render(host, block, [line(0, block.text.length)])
    expect(host.querySelectorAll("strong")).toHaveLength(1)
    expect(host.querySelectorAll("em")).toHaveLength(1)
    expect(host.querySelectorAll("a")).toHaveLength(1)
    expect(host.textContent).toBe("alpha beta gamma delta")
  })

  test("a protruding opening glyph receives its measured negative margin", () => {
    const { host, block } = source("“alpha”")
    const rendered = render(host, block, [
      { ...line(0, block.text.length), hangStart: 3 },
    ])!
    expect(rendered[0]?.style.marginInlineStart).toBe("-3px")
  })
})
