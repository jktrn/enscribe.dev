import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import * as pretext from "@chenglou/pretext"
import { metricsForStyle } from "@linebreak/dom/measure-dom"

vi.mock("@chenglou/pretext", { spy: true })
type Prepared = ReturnType<typeof pretext.prepareWithSegments>
const probes: HTMLElement[] = []
const hosts: HTMLElement[] = []

const style = (overrides: Partial<CSSStyleDeclaration> = {}) => {
  const value = document.createElement("span").style
  Object.assign(value, {
    fontStretch: "100%", fontVariationSettings: "normal", fontVariantAlternates: "normal",
    fontVariantCaps: "normal", fontVariantEastAsian: "normal", fontVariantLigatures: "none",
    fontVariantNumeric: "normal", fontVariantPosition: "normal", fontFeatureSettings: "normal",
  }, overrides)
  return value
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("OffscreenCanvas", undefined)
  probes.length = 0
  hosts.length = 0
  vi.spyOn(pretext, "prepareWithSegments").mockImplementation((text) => {
    const segments = text.split(/( +)/u).filter(Boolean)
    return { segments, kinds: segments.map((part) => part.trim() ? "text" : "space"), widths: segments.map((part) => part.length * 6) } as Prepared
  })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    probes.push(this)
    const host = this.parentElement!
    if (!hosts.includes(host)) hosts.push(host)
    expect(this.isConnected).toBe(true)
    expect(host.getAttribute("aria-hidden")).toBe("true")
    expect(host.style.pointerEvents).toBe("none")
    expect(host.style.contain).toBe("layout style paint")
    expect(host.style.position).toBe("absolute")
    expect(host.style.left).toBe("-100000px")
    expect(host.style.top).toBe("0px")
    expect(host.style.visibility).toBe("hidden")
    return new DOMRect(0, 0, this.textContent!.length * 7, 16)
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren() })

const metrics = (overrides: Partial<CSSStyleDeclaration> = {}) => {
  const value = metricsForStyle(document, style(overrides), "16px serif", 0)
  if (!value) throw new Error("DOM metrics unavailable")
  probes.length = 0
  hosts.length = 0
  return value
}

describe("DOM metrics through their production entry", () => {
  test("plain DOM-measured paragraphs preserve offsets without text analysis", () => {
    const measured = metrics()
    vi.mocked(pretext.prepareWithSegments).mockClear()
    expect(measured.measureParagraph("a(b),  c.")?.segments).toEqual([
      { text: "a(b),", start: 0, end: 5, kind: "text", width: 35, lineEndWidth: 0 },
      { text: "  ", start: 5, end: 7, kind: "space", width: 14, lineEndWidth: 0 },
      { text: "c.", start: 7, end: 9, kind: "text", width: 14, lineEndWidth: 0 },
    ])
    expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    measured.measureParagraph("a-b?")
    expect(pretext.prepareWithSegments).toHaveBeenCalledOnce()
  })

  test("paragraph probes are all attached before any layout read, then cleaned up", () => {
    const measured = metrics()
    const read = vi.mocked(HTMLElement.prototype.getBoundingClientRect).getMockImplementation()!
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      expect([...this.parentElement!.children].map((node) => node.textContent)).toEqual(["a", " ", "bb", "ccc"])
      return read.call(this)
    })
    const paragraph = measured.measureParagraph("a bb ccc")
    expect(paragraph?.segments.map((part) => part.width)).toEqual([7, 7, 14, 7, 21])
    expect(probes).toHaveLength(4)
    expect(hosts).toHaveLength(1)
    expect(hosts[0]?.isConnected).toBe(false)
  })

  test("repeated and warmed strings share one measured advance", () => {
    const measured = metrics()
    measured.measureParagraph("a a a")
    expect(probes).toHaveLength(2)
    const append = vi.spyOn(document.body, "append")
    measured.measureParagraph("a a a")
    expect(append).not.toHaveBeenCalled()
    expect(measured.measureRun("a")).toBe(7)
    expect(probes).toHaveLength(2)
    expect(measured.measureRun("new")).toBe(21)
    expect(measured.measureRun("new")).toBe(21)
    expect(probes).toHaveLength(3)
    expect(measured.measureRun("")).toBe(0)
    expect(probes).toHaveLength(3)
  })

  test("probe styles carry font, spacing, and every variant property", () => {
    const authored = style({ fontVariantCaps: "all-small-caps", fontVariantNumeric: "oldstyle-nums", fontVariantPosition: "super", fontFeatureSettings: '"smcp"' })
    const measured = metricsForStyle(document, authored, "italic 700 18px serif", 0.25)!
    measured.measureRun("ab")
    const probe = probes.at(-1)!
    expect(probe.style.fontStyle).toBe("italic")
    expect(probe.style.fontWeight).toBe("700")
    expect(probe.style.fontSize).toBe("18px")
    expect(probe.style.fontFamily).toBe("serif")
    expect(probe.style.letterSpacing).toBe("0.25px")
    expect(probe.style.fontVariantCaps).toBe("all-small-caps")
    expect(probe.style.fontVariantLigatures).toBe("none")
    expect(probe.style.fontVariantNumeric).toBe("oldstyle-nums")
    expect(probe.style.fontVariantPosition).toBe("super")
    expect(probe.style.fontFeatureSettings).toBe('"smcp"')
    expect(probe.style.fontVariantEastAsian).toBe("normal")
    expect(probe.style.whiteSpace).toBe("pre")
    expect(measured.hyphenWidth).toBe(7)
  })

  test("plain font runs stay on the shaping adapter without DOM probes", () => {
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "16px serif", 0)
    expect(measured?.measureRun("word")).toBe(24)
    expect(probes).toHaveLength(0)
  })

  test("plain runs defer Unicode calibration and avoid repeating paragraph preparation", () => {
    const context = {
      font: "",
      letterSpacing: "0px",
      measureText: vi.fn((text: string) => ({ width: text.length * 6 }) as TextMetrics),
    } as Pick<CanvasRenderingContext2D, "font" | "letterSpacing" | "measureText"> as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      expect(this.parentElement?.childElementCount).toBe(1)
      return new DOMRect(0, 0, this.textContent!.length * 6, 16)
    })
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "18px serif", 0)!
    expect(HTMLElement.prototype.getBoundingClientRect).toHaveBeenCalledOnce()
    expect(context.measureText).not.toHaveBeenCalledWith("🙂")
    vi.mocked(pretext.prepareWithSegments).mockClear()
    vi.mocked(context.measureText).mockClear()
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockClear()
    expect(measured.measureRun("pre")).toBe(18)
    expect(measured.measureRun("pre")).toBe(18)
    expect(context.font).toBe("18px serif")
    expect(context.letterSpacing).toBe("0px")
    expect(context.measureText).toHaveBeenCalledOnce()
    expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    expect(measured.measureParagraph("prefix")?.segments[0]?.width).toBe(36)
    expect(measured.measureParagraph("prefix")?.segments[0]?.width).toBe(36)
    expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    expect(context.measureText).toHaveBeenCalledTimes(2)
    expect(HTMLElement.prototype.getBoundingClientRect).not.toHaveBeenCalled()
    expect(probes).toHaveLength(0)
    const hyphenated = measured.measureParagraph("inter\u00adnational well-known")!
    expect(hyphenated.segments.map(({ text, kind, width, lineEndWidth }) => [text, kind, width, lineEndWidth])).toEqual([
      ["inter", "text", 30, 0], ["\u00ad", "soft-hyphen", 0, 6], ["national", "text", 48, 0],
      [" ", "space", 6, 0], ["well-", "text", 30, 0], ["known", "text", 30, 0],
    ])
    expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    expect(HTMLElement.prototype.getBoundingClientRect).not.toHaveBeenCalled()
    expect(measured.measureRun("🙂")).toBe(12)
    expect(context.measureText).toHaveBeenCalledWith("🙂")
    expect(HTMLElement.prototype.getBoundingClientRect).toHaveBeenCalledOnce()
  })

  test.each([true, false])("punctuation analysis requires matching rendered glyph widths: %s", (compatible) => {
    const context = {
      font: "", measureText: (text: string) => ({ width: text.length * 6 }) as TextMetrics,
    } as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const text = this.textContent!
      return new DOMRect(0, 0, text.length * 6 + (!compatible && text === "“”‘’—" ? 1 : 0), 16)
    })
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "19px serif", 0)!
    vi.mocked(pretext.prepareWithSegments).mockClear()
    const paragraph = measured.measureParagraph("“word”")!
    expect(paragraph.segments.map(({ text, width }) => [text, width])).toEqual([["“word”", 36]])
    if (compatible) expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    else expect(pretext.prepareWithSegments).toHaveBeenCalled()
  })

  test("a canvas font that disagrees with rendered text uses DOM paragraph and run widths", () => {
    const canvases: HTMLCanvasElement[] = []
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this)
      expect(this.isConnected).toBe(true)
      return {
        font: "",
        measureText: (text: string) => ({ width: text.length * 9 }) as TextMetrics,
      } as CanvasRenderingContext2D
    })
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "32px monospace", 0)!
    expect(measured.measureRun("AVATAR")).toBe(42)
    expect(measured.measureParagraph("one two")?.segments.map((part) => part.width)).toEqual([21, 7, 21])
    expect(canvases).toHaveLength(1)
    expect(canvases.every((canvas) => !canvas.isConnected)).toBe(true)
    expect(document.body.childElementCount).toBe(0)
  })

  test("a connected canvas context failure preserves the shaping adapter fallback", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null)
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "16px serif", 0)!
    expect(measured.measureRun("word")).toBe(24)
    expect(document.body.childElementCount).toBe(0)
  })

  test("correct Canvas widths cannot hide a mismatched paragraph shaping adapter", () => {
    vi.spyOn(pretext, "prepareWithSegments").mockImplementation((text) => ({
      segments: [text], kinds: ["text"], widths: [text.length * (text.includes("🙂") ? 7 : 6)],
    }) as Prepared)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "", measureText: (text: string) => ({ width: text.length * 7 }) as TextMetrics,
    } as CanvasRenderingContext2D)
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "17px serif", 0)!
    expect(measured.measureRun("word")).toBe(28)
    expect(measured.measureParagraph("word")?.segments[0]?.width).toBe(28)
  })

  test("bitmap emoji are calibrated independently of ordinary glyphs", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, this.textContent!.length * 6, 16)
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "", measureText: (text: string) => ({ width: text.length * 6 + (text.includes("🙂") ? 2 : 0) }) as TextMetrics,
    } as CanvasRenderingContext2D)
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "17px serif", 0)!
    expect(measured.measureRun("a🙂b")).toBe(24)
    expect(measured.measureParagraph("a🙂b")?.segments[0]?.width).toBe(24)
  })

  test("the fast path uses the adapter's OffscreenCanvas API when available", () => {
    const context = {
      font: "", measureText: vi.fn((text: string) => ({ width: text.length * 6 }) as TextMetrics),
    }
    vi.stubGlobal("OffscreenCanvas", class {
      constructor(width: number, height: number) { expect([width, height]).toEqual([1, 1]) }
      getContext(kind: string) { expect(kind).toBe("2d"); return context }
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, 0, this.textContent!.length * 6, 16)
    })
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "17px serif", 0)!
    expect(measured.measureRun("prefix")).toBe(36)
    expect(context.font).toBe("17px serif")
    expect(context.measureText).toHaveBeenCalledWith("prefix")
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
  })

  test("an unavailable OffscreenCanvas context keeps the shaping adapter fallback", () => {
    vi.stubGlobal("OffscreenCanvas", class { getContext() { return null } })
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "17px serif", 0)!
    expect(measured.measureRun("prefix")).toBe(36)
  })

  test.each([
    { native: 0.02, adapter: 0 },
    { native: 0, adapter: 0.02 },
  ])("rendered quantization at the tolerance boundary is accepted: %j", ({ native, adapter }) => {
    vi.spyOn(pretext, "prepareWithSegments").mockImplementation((text) => ({
      segments: [text], kinds: ["text"], widths: [adapter],
    }) as Prepared)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect())
    const context: Pick<CanvasRenderingContext2D, "font" | "measureText"> = {
      font: "", measureText: () => ({ width: native }) as TextMetrics,
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as CanvasRenderingContext2D)
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "0px serif", 0)!
    expect(measured.measureRun("word")).toBe(native)
    // ASCII paragraphs and hyphenation prefixes share the calibrated provider.
    expect(measured.measureParagraph("word")?.segments[0]?.width).toBe(native)
    // General text still uses the separately calibrated shaping adapter.
    expect(measured.measureParagraph("é")?.segments[0]?.width).toBe(adapter)
  })

  test("a context without a rendered calibration root is declined", () => {
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() { return { font: "", measureText: () => ({ width: 0 }) } }
    })
    const root = document.documentElement
    root.remove()
    try { expect(metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "17px serif", 0)).toBeNull() }
    finally { document.append(root) }
  })

  test("a document without a browsing context can use the adapter fallback", () => {
    const detached = document.implementation.createHTMLDocument()
    expect(detached.defaultView).toBeNull()
    const measured = metricsForStyle(detached, style({ fontVariantLigatures: "normal" }), "17px serif", 0)!
    expect(measured.measureRun("prefix")).toBe(36)
    expect(detached.body.childElementCount).toBe(0)
  })

  test("an unavailable probe root preserves the shaping adapter fallback", () => {
    const context: Pick<CanvasRenderingContext2D, "font" | "measureText"> = {
      font: "", measureText: () => ({ width: 90 }) as TextMetrics,
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as CanvasRenderingContext2D)
    const root = document.documentElement
    root.remove()
    try {
      const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "16px serif", 0)!
      expect(measured.measureRun("word")).toBe(24)
    } finally { document.append(root) }
  })

  test("authored letter spacing uses rendered DOM advances even with ordinary font variants", () => {
    const context = {
      font: "",
      measureText: vi.fn(() => ({ width: 999 }) as TextMetrics),
    } as Pick<CanvasRenderingContext2D, "font" | "measureText"> as CanvasRenderingContext2D
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context)
    const measured = metricsForStyle(document, style({ fontVariantLigatures: "normal" }), "16px serif", 0.5)!
    expect(measured.measureRun("pre")).toBe(21)
    expect(context.measureText).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
    expect(pretext.prepareWithSegments).not.toHaveBeenCalled()
    expect(probes.at(-1)?.style.letterSpacing).toBe("0.5px")
  })

  test("the document root hosts probes when the body is absent", () => {
    const body = document.body
    body.remove()
    try {
      expect(metrics().measureRun("ab")).toBe(14)
      expect(probes.at(-1)?.parentElement?.parentElement).toBeNull()
    } finally { document.documentElement.append(body) }
  })

  test("a document without any root is declined", () => {
    const root = document.documentElement
    root.remove()
    try { expect(metricsForStyle(document, style(), "16px serif", 0)).toBeNull() }
    finally { document.append(root) }
  })

  test("a detached root after creation cannot leave stale probe hosts", () => {
    const measured = metrics()
    const root = document.documentElement
    root.remove()
    try { expect(measured.measureRun("missing")).toBe(0) }
    finally { document.append(root) }
    expect(hosts).toHaveLength(0)
  })
})
