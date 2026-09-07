import { beforeEach, describe, expect, test, vi } from "vitest"
import {
  invalidateStretchScales,
  stretchScaleFor,
} from "@linebreak/dom/stretch"

const BUDGET = 0.02
const BASE = 400

type Probe = HTMLElement

const measuredDocument = (
  widthAt: (pct: number) => number,
  host: "body" | "root" | "none" = "body",
) => {
  const doc = document.implementation.createHTMLDocument()
  if (host === "root") doc.body.remove()
  if (host === "none") doc.documentElement.remove()
  const probes: HTMLElement[] = []
  const hosts: HTMLElement[] = []
  const asked: number[] = []
  const create = doc.createElement.bind(doc)
  vi.spyOn(doc, "createElement").mockImplementation((tag, options) => {
    const element = create(tag, options)
    if (tag === "span") {
      probes.push(element)
      element.getBoundingClientRect = () => {
        if (!element.isConnected) return new DOMRect()
        const pct = Number.parseFloat(element.style.fontStretch)
        asked.push(pct)
        return new DOMRect(0, 0, widthAt(pct), 20)
      }
    } else hosts.push(element)
    return element
  })
  const seen = {
    probes,
    hosts,
    asked,
    get attached() {
      return doc.querySelectorAll('[aria-hidden="true"]').length
    },
    get text() {
      return probes[0]?.textContent ?? ""
    },
  }
  return { seen, document: doc }
}

const affine = (pct: number) => (BASE * pct) / 100

const flat = () => BASE

beforeEach(() => {
  invalidateStretchScales()
})

describe("a font whose advance answers the width axis", () => {
  test("the calibrated table is the ratios the probe reported", () => {
    const { document } = measuredDocument(affine)

    const scale = stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(scale?.steps).toEqual([
      { pct: 98, ratio: 0.98 },
      { pct: 99, ratio: 0.99 },
      { pct: 100, ratio: 1 },
      { pct: 101, ratio: 1.01 },
      { pct: 102, ratio: 1.02 },
    ])
  })

  test("the probe carries the run's own font and letter-spacing", () => {
    const { seen, document } = measuredDocument(affine)

    stretchScaleFor(document, "italic 700 18px/1.5 Plex", 0.25, BUDGET)

    const probe = seen.probes[0] as Probe
    expect(probe.style.fontStyle).toBe("italic")
    expect(probe.style.fontWeight).toBe("700")
    expect(probe.style.fontSize).toBe("18px")
    expect(probe.style.lineHeight).toBe("1.5")
    expect(probe.style.fontFamily).toBe("Plex")
    expect(probe.style.letterSpacing).toBe("0.25px")
    expect(probe.style.whiteSpace).toBe("pre")
    expect(seen.text.length).toBeGreaterThan(20)

    const host = seen.hosts[0] as Probe
    expect(host.getAttribute("aria-hidden")).toBe("true")
    expect(host.style.visibility).toBe("hidden")
  })

  test("the probe leaves the document as it found it", () => {
    const { seen, document } = measuredDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.attached).toBe(0)
  })
})

describe("a font with no width axis", () => {
  test("declines rather than budgeting width the font cannot deliver", () => {
    const { document } = measuredDocument(flat)

    expect(stretchScaleFor(document, "16px Lorien", 0, BUDGET)).toBeNull()
  })

  test("the decline is measured, not guessed", () => {
    const { seen, document } = measuredDocument(flat)

    stretchScaleFor(document, "16px Lorien", 0, BUDGET)

    expect(seen.asked.length).toBeGreaterThan(1)
    expect(seen.asked).toContain(100)
  })
})

describe("a family that answers with a condensed face instead of an axis", () => {
  test("declines, because one point of width cannot move an advance 12%", () => {
    const { document } = measuredDocument((pct) =>
      pct < 100 ? BASE * 0.88 : (BASE * pct) / 100,
    )

    expect(stretchScaleFor(document, "16px Faked", 0, BUDGET)).toBeNull()
  })
})

describe("the calibration cache", () => {
  test("one font is probed once, however many runs ask for it", () => {
    const { seen, document } = measuredDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.probes.length).toBe(1)
  })

  test("a decline is cached too, so a static font is probed once", () => {
    const { seen, document } = measuredDocument(flat)

    stretchScaleFor(document, "16px Lorien", 0, BUDGET)
    stretchScaleFor(document, "16px Lorien", 0, BUDGET)

    expect(seen.probes.length).toBe(1)
  })

  test("letter-spacing is part of the key, since it dilutes the ratio", () => {
    const { seen, document } = measuredDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0.5, BUDGET)

    expect(seen.probes.length).toBe(2)
  })

  test("invalidating re-probes, because a font swap is a new axis", () => {
    const { seen, document } = measuredDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    invalidateStretchScales()
    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.probes.length).toBe(2)
  })

  test("two documents do not share a calibration", () => {
    const first = measuredDocument(affine)
    const second = measuredDocument(flat)

    const one = stretchScaleFor(first.document, "16px Plex", 0, BUDGET)
    const two = stretchScaleFor(second.document, "16px Plex", 0, BUDGET)

    expect(one).not.toBeNull()
    expect(two).toBeNull()
  })
})

describe("a document with nowhere to attach a probe", () => {
  test("declines without measuring", () => {
    const { seen, document } = measuredDocument(affine, "none")

    expect(stretchScaleFor(document, "16px Plex", 0, BUDGET)).toBeNull()
    expect(seen.probes.length).toBe(0)
  })

  test("falls back to the root element when there is no body", () => {
    const { seen, document } = measuredDocument(affine, "root")

    expect(stretchScaleFor(document, "16px Plex", 0, BUDGET)).not.toBeNull()
    expect(seen.attached).toBe(0)
  })
})
