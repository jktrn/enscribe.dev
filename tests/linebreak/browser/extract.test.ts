import { afterEach, describe, expect, test } from "vitest"
import { extractBlock, outerWidth, runEdgeWidths } from "@linebreak/dom/extract"
import { Collapser } from "@linebreak/dom/extract/collapse"
import { type RawText } from "@linebreak/dom/extract/walk"
import { OBJECT_REPLACEMENT } from "@linebreak/dom/extract/runs"
import { compileBlock } from "@linebreak/layout/compile"
import { createMetrics } from "@linebreak/text/segments"

afterEach(() => document.body.replaceChildren())

import { extract, fixture, read } from "./support/extraction"

describe("DOM extraction", () => {
  test.each([
    ["alpha <wbr> beta", "alpha beta", [6]],
    ["alpha <wbr> <wbr> beta", "alpha beta", [6, 6]],
    [" <wbr> alpha", "alpha", [0]],
    ["alpha <wbr> ", "alpha", [5]],
    ["alpha <wbr> <br> beta", "alpha\nbeta", [5, 5]],
  ] as const)("whitespace around optional breaks collapses once in %s", (html, text, positions) => {
    const block = extract(html)
    expect(block.text).toBe(text)
    expect(
      block.runs.filter((run) => run.kind === "break").map((run) => run.start),
    ).toEqual(positions)
    const metrics = createMetrics({
      font: "16px serif",
      measure: (part) => part.length * 10,
    })
    const compiled = compileBlock({
      block,
      baseFont: metrics.font,
      locale: "en",
      metricsFor: () => metrics,
    })
    if (!compiled.ok) throw new Error(compiled.reason)
    const spaces = compiled.items
      .filter((item) => item.kind === "glue")
      .filter((item) => item.source?.end !== item.source?.start)
    expect(spaces.map((space) => space.width)).toEqual(
      text.includes(" ") ? [10] : [],
    )
  })

  test("optional breaks retain marker order and whitespace padding ownership", () => {
    const block = extract(
      'alpha<i id="before"> </i><wbr id="hint"><b id="after"> </b>beta',
    )
    expect(block.text).toBe("alpha beta")
    expect(
      block.runs
        .filter((run) => run.kind === "anchor" || run.kind === "break")
        .map((run) => [
          run.sourceElement.id,
          run.start,
          run.kind === "anchor" ? run.affinity : "break",
        ]),
    ).toEqual([
      ["before", 5, "previous"],
      ["hint", 6, "break"],
      ["after", 6, "next"],
    ])
  })

  test("adjacent text nodes in one element retain shared shaping context", () => {
    const p = fixture("")
    p.append(
      document.createTextNode("T"),
      document.createComment("editor split"),
      document.createTextNode("o"),
    )
    const extracted = extractBlock(p, read)
    if (!extracted.ok) throw new Error(extracted.reason)
    const metrics = createMetrics({
      font: "16px serif",
      measure: (text) => (text === "To" ? 17 : text.length * 10),
    })
    const compiled = compileBlock({
      block: extracted.block,
      baseFont: metrics.font,
      locale: "en",
      metricsFor: () => metrics,
    })
    if (!compiled.ok) throw new Error(compiled.reason)
    expect(
      compiled.items
        .filter((item) => item.kind === "box")
        .map((item) => item.width),
    ).toEqual([17])
  })

  test("split text-node whitespace introduces no artificial wrapper anchors", () => {
    const p = fixture("")
    p.append(
      document.createTextNode("alpha"),
      document.createTextNode(" "),
      document.createTextNode("beta"),
    )
    const extracted = extractBlock(p, read)
    if (!extracted.ok) throw new Error(extracted.reason)
    expect(extracted.block.runs.map((run) => run.kind)).toEqual(["text"])
    expect(extracted.block.text).toBe("alpha beta")
  })

  test("collapses source whitespace across nested inline markup and retains wrappers", () => {
    const block = extract(
      "  alpha\n <strong> beta <em>gamma</em></strong>  delta\t ",
    )
    expect(block.text).toBe("alpha beta gamma delta")
    expect(
      block.runs
        .filter((run) => run.kind === "text")
        .map((run) => run.text)
        .join(""),
    ).toBe(block.text)
    expect(block.wrappers.size).toBe(2)
    expect([...block.wrappers.keys()].map((node) => node.tagName)).toEqual([
      "STRONG",
      "EM",
    ])
  })

  test("ignores comments, hidden nodes, decorations, and empty text nodes", () => {
    const p = fixture(
      'alpha<!-- comment --><span style="display:none">hidden</span><i data-linebreak-decoration aria-hidden="true">icon</i> beta',
    )
    p.append(document.createTextNode(""))
    const result = extractBlock(p, read)
    expect(result.ok && result.block.text).toBe("alpha beta")
  })

  test.each([
    ["", "empty"],
    [" \n\t ", "empty"],
    ["<div>nested block</div>", "unsupported-content"],
    ["<input>", "unsupported-content"],
    ["<span data-preserve>preserved whitespace</span>", "unsupported-content"],
    [
      '<span><span data-display="grid">grid</span></span>',
      "unsupported-content",
    ],
    ['<svg data-display="block"></svg>', "unsupported-content"],
  ])("declines %s as %s", (html, reason) => {
    expect(extractBlock(fixture(html), read)).toEqual({ ok: false, reason })
  })

  test("enforces the exact character boundary after whitespace collapse", () => {
    const p = fixture("  alpha  ")
    expect(extractBlock(p, read, 4)).toEqual({ ok: false, reason: "too-long" })
    expect(extractBlock(p, read, 5).ok).toBe(true)
  })

  test.each([
    "<img>",
    "<input disabled>",
    "<span data-linebreak-atom>widget</span>",
    '<span data-display="inline-flex">flex</span>',
    '<math data-display="math">math</math>',
    '<ruby data-display="ruby">ruby</ruby>',
    '<svg data-display="inline"></svg>',
  ])("retains %s as one indivisible atom", (html) => {
    const block = extract(`a ${html} b`)
    expect(block.text).toBe(`a ${OBJECT_REPLACEMENT} b`)
    expect(block.runs.filter((run) => run.kind === "atom")).toHaveLength(1)
  })

  test("display contents keeps semantic wrappers without creating a box", () => {
    const block = extract(
      '<span style="display:contents">alpha <em>beta</em></span>',
    )
    expect(block.text).toBe("alpha beta")
    expect([...block.wrappers.values()][0]?.leading.width).toBe(0)
  })

  test("a visible empty inline with width is an atom; a zero-width one vanishes", () => {
    const p = fixture('a<span id="wide"></span><span></span>b')
    const wide = p.querySelector("#wide")!
    wide.getBoundingClientRect = () => new DOMRect(0, 0, 12, 10)
    const result = extractBlock(p, read)
    expect(result.ok && result.block.text).toBe(`a${OBJECT_REPLACEMENT}b`)
  })

  test("forced and optional authored breaks keep distinct offsets", () => {
    const block = extract("alpha   <br>   beta<wbr>gamma")
    expect(block.text).toBe("alpha\nbetagamma")
    expect(
      block.runs
        .filter((run) => run.kind === "break")
        .map((run) => [run.start, run.end, run.forced]),
    ).toEqual([
      [5, 6, true],
      [10, 10, false],
    ])
  })

  test("nowrap runs preserve restrictions and disable discretionary hyphenation", () => {
    const block = extract(
      "<span data-nowrap>alpha <em>beta</em> gamma</span> delta",
    )
    expect(block.breakRestrictions).toEqual([{ start: 1, end: 16 }])
    expect(
      block.runs.every(
        (run) => run.kind !== "text" || run.start >= 16 || !run.hyphenates,
      ),
    ).toBe(true)
    expect(block.runs.at(-1)?.kind).toBe("text")
  })

  test("adjacent nowrap owners create adjacent restrictions that coalesce", () => {
    const block = extract(
      "<span data-nowrap>ab </span><span data-nowrap>cd</span>",
    )
    expect(block.text).toBe("ab cd")
    expect(block.breakRestrictions).toEqual([{ start: 1, end: 5 }])
  })

  test("a single nowrap character has no interior break to prohibit", () => {
    const p = fixture("a")
    p.setAttribute("data-nowrap", "")
    const result = extractBlock(p, read)
    expect(result.ok && result.block.breakRestrictions).toEqual([])
  })

  test("whitespace-only wrappers retain anchors at beginning, middle, end and hard breaks", () => {
    const block = extract(
      "<i> </i>alpha<i> </i><b> </b>beta<i> </i><br><i> </i>gamma<i> </i>",
    )
    expect(block.text).toBe("alpha beta\ngamma")
    const anchors = block.runs.filter((run) => run.kind === "anchor")
    expect(anchors.map((run) => [run.start, run.affinity])).toEqual([
      [0, "next"],
      [5, "previous"],
      [5, "previous"],
      [10, "previous"],
      [11, "next"],
      [16, "previous"],
    ])
  })

  test("decoration and box edges are charged once to their wrapper boundary runs", () => {
    const p = fixture(
      '<span style="padding-inline-start:2px;padding-inline-end:3px"><i data-linebreak-decoration aria-hidden="true">before</i>alpha <em>beta</em><i data-linebreak-decoration aria-hidden="true" data-linebreak-decoration-position="after">after</i></span>',
    )
    for (const decoration of p.querySelectorAll("i")) {
      decoration.getBoundingClientRect = () => new DOMRect(0, 0, 4, 10)
    }
    const result = extractBlock(p, read)
    if (!result.ok) throw new Error(result.reason)
    const { block } = result
    expect(block.text).toBe("alpha beta")
    expect(runEdgeWidths(block, block.runs[0]!)).toEqual({
      leading: 6,
      trailing: 0,
    })
    expect(runEdgeWidths(block, block.runs.at(-1)!)).toEqual({
      leading: 0,
      trailing: 7,
    })
    expect(
      runEdgeWidths({ ...block, wrappers: new Map() }, block.runs[0]!),
    ).toEqual({ leading: 0, trailing: 0 })
  })

  test("outer width includes both margins and ignores hidden elements", () => {
    const p = fixture(
      '<span style="margin-inline-start:2px;margin-inline-end:3px"></span>',
    )
    const span = p.querySelector("span")!
    span.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10)
    expect(outerWidth(span, read)).toBe(15)
    span.style.display = "none"
    expect(outerWidth(span, read)).toBe(0)
  })

  test("unsupported nested content declines the entire extraction without changing authored DOM", () => {
    const html = "<span>alpha<div>block</div></span>"
    const source = fixture(html)
    expect(extractBlock(source, read)).toEqual({
      ok: false,
      reason: "unsupported-content",
    })
    expect(source.innerHTML).toBe(html)
  })

  test("raw whitespace contributors preserve one space and the same wrapper anchor once", () => {
    const element = fixture("text")
    const wrapper = document.createElement("span")
    const wrappers = [wrapper]
    const raw = (text: string, enclosed = false): RawText => ({
      kind: "text",
      text,
      sourceElement: element,
      wrappers: enclosed ? wrappers : [],
    })
    const result = Collapser.collapse([
      raw("alpha"),
      raw(" ", true),
      raw("\t", true),
      raw("beta"),
    ])
    expect(result.text).toBe("alpha beta")
    expect(result.runs.filter((run) => run.kind === "anchor")).toHaveLength(1)
  })
})

test("a collapsed space permits wrapping if any contributing node permits it", () => {
  const nowrap = extract(
    "<span data-nowrap>alpha </span><span data-nowrap> </span>beta",
  )
  const mixed = extract("<span data-nowrap>alpha </span><span> </span>beta")
  expect(nowrap.text).toBe("alpha beta")
  expect(mixed.text).toBe(nowrap.text)
  expect(
    nowrap.breakRestrictions.some((range) => range.start <= 5 && range.end > 5),
  ).toBe(true)
  expect(
    mixed.breakRestrictions.some((range) => range.start <= 5 && range.end > 5),
  ).toBe(false)
})

test("wrapper edge widths include both borders and margins but display contents has no box", () => {
  const declaration =
    "margin-inline-start:3px;border-inline-start-width:5px;border-inline-start-style:solid;padding-inline-start:7px;padding-inline-end:11px;border-inline-end-width:13px;border-inline-end-style:solid;margin-inline-end:17px"
  for (const display of ["inline", "contents"]) {
    const block = extract(
      `<em style="${declaration};display:${display}">alpha beta</em>`,
    )
    const wrapper = [...block.wrappers.values()][0]!
    expect(wrapper.leading.width).toBe(display === "contents" ? 0 : 15)
    expect(wrapper.trailing.width).toBe(display === "contents" ? 0 : 41)
  }
})

test("wrappers already carried by text, atoms, or breaks do not gain redundant space anchors", () => {
  for (const html of [
    "<em> alpha beta </em>",
    "<em> <img> </em>",
    "<em> <br> </em>",
  ]) {
    const block = extract(html)
    expect(block.runs.some((run) => run.kind === "anchor")).toBe(false)
  }
  const block = extract("<em>alpha beta</em><strong>gamma delta</strong>")
  expect(block.runs).toHaveLength(2)
  expect(block.runs.map((run) => run.sourceElement.tagName)).toEqual([
    "EM",
    "STRONG",
  ])
  expect(
    block.runs.map((run) => run.wrappers.map((wrapper) => wrapper.tagName)),
  ).toEqual([["EM"], ["STRONG"]])
})

test("an empty text node in a preserving wrapper introduces no unsupported content", () => {
  const source = fixture("alpha<span data-preserve></span>beta")
  source.querySelector("span")!.append(document.createTextNode(""))
  const result = extractBlock(source, read)
  expect(result.ok && result.block.text).toBe("alphabeta")
})
