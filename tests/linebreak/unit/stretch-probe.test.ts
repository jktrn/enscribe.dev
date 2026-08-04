import { beforeEach, describe, expect, test } from "bun:test"
import {
  invalidateStretchScales,
  stretchScaleFor,
} from "@linebreak/dom/stretch"

const BUDGET = 0.02
const BASE = 400

type Probe = {
  readonly style: Record<string, string>
  readonly attribute: Record<string, string>
}

type Recorder = {
  readonly probes: Probe[]
  readonly hosts: Probe[]
  readonly asked: number[]
  attached: number
  text: string
}

const fakeDocument = (
  widthAt: (pct: number) => number,
  host: "body" | "root" | "none" = "body",
) => {
  const seen: Recorder = {
    probes: [],
    hosts: [],
    asked: [],
    attached: 0,
    text: "",
  }

  const made = new Map<object, Probe>()

  const parent = {
    append: (child: object) => {
      seen.hosts.push(made.get(child) as Probe)
      seen.attached += 1
    },
  }

  const createElement = () => {
    const probe: Probe = { style: {}, attribute: {} }
    const element = {
      style: probe.style,
      setAttribute: (name: string, value: string) => {
        probe.attribute[name] = value
      },
      set textContent(value: string) {
        seen.text = value
      },
      append: (child: object) => {
        seen.probes.push(made.get(child) as Probe)
      },
      remove: () => {
        seen.attached -= 1
      },
      getBoundingClientRect: () => {
        const pct = Number.parseFloat(probe.style.fontStretch ?? "")
        seen.asked.push(pct)
        return { width: widthAt(pct) }
      },
    }
    made.set(element, probe)
    return element
  }

  const document = {
    createElement,
    ...(host === "body" ? { body: parent } : {}),
    ...(host === "root" ? { documentElement: parent } : {}),
  }

  return { seen, document: document as unknown as Document }
}

const affine = (pct: number) => (BASE * pct) / 100

const flat = () => BASE

beforeEach(() => {
  invalidateStretchScales()
})

describe("a font whose advance answers the width axis", () => {
  test("the calibrated table is the ratios the probe reported", () => {
    const { document } = fakeDocument(affine)

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
    const { seen, document } = fakeDocument(affine)

    stretchScaleFor(document, "italic 700 18px/1.5 Plex", 0.25, BUDGET)

    const probe = seen.probes[0] as Probe
    expect(probe.style.font).toBe("italic 700 18px/1.5 Plex")
    expect(probe.style.letterSpacing).toBe("0.25px")
    expect(probe.style.whiteSpace).toBeUndefined()
    expect(probe.style.cssText).toContain("white-space:pre")
    expect(seen.text.length).toBeGreaterThan(20)

    const host = seen.hosts[0] as Probe
    expect(host.attribute["aria-hidden"]).toBe("true")
    expect(host.style.cssText).toContain("visibility:hidden")
  })

  test("the probe leaves the document as it found it", () => {
    const { seen, document } = fakeDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.attached).toBe(0)
  })
})

describe("a font with no width axis", () => {
  test("declines rather than budgeting width the font cannot deliver", () => {
    const { document } = fakeDocument(flat)

    expect(stretchScaleFor(document, "16px Lorien", 0, BUDGET)).toBeNull()
  })

  test("the decline is measured, not guessed", () => {
    const { seen, document } = fakeDocument(flat)

    stretchScaleFor(document, "16px Lorien", 0, BUDGET)

    expect(seen.asked.length).toBeGreaterThan(1)
    expect(seen.asked).toContain(100)
  })
})

describe("a family that answers with a condensed face instead of an axis", () => {
  test("declines, because one point of width cannot move an advance 12%", () => {
    const { document } = fakeDocument((pct) =>
      pct < 100 ? BASE * 0.88 : (BASE * pct) / 100,
    )

    expect(stretchScaleFor(document, "16px Faked", 0, BUDGET)).toBeNull()
  })
})

describe("the calibration cache", () => {
  test("one font is probed once, however many runs ask for it", () => {
    const { seen, document } = fakeDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.probes.length).toBe(1)
  })

  test("a decline is cached too, so a static font is probed once", () => {
    const { seen, document } = fakeDocument(flat)

    stretchScaleFor(document, "16px Lorien", 0, BUDGET)
    stretchScaleFor(document, "16px Lorien", 0, BUDGET)

    expect(seen.probes.length).toBe(1)
  })

  test("letter-spacing is part of the key, since it dilutes the ratio", () => {
    const { seen, document } = fakeDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    stretchScaleFor(document, "16px Plex", 0.5, BUDGET)

    expect(seen.probes.length).toBe(2)
  })

  test("invalidating re-probes, because a font swap is a new axis", () => {
    const { seen, document } = fakeDocument(affine)

    stretchScaleFor(document, "16px Plex", 0, BUDGET)
    invalidateStretchScales()
    stretchScaleFor(document, "16px Plex", 0, BUDGET)

    expect(seen.probes.length).toBe(2)
  })

  test("two documents do not share a calibration", () => {
    const first = fakeDocument(affine)
    const second = fakeDocument(flat)

    const one = stretchScaleFor(first.document, "16px Plex", 0, BUDGET)
    const two = stretchScaleFor(second.document, "16px Plex", 0, BUDGET)

    expect(one).not.toBeNull()
    expect(two).toBeNull()
  })
})

describe("a document with nowhere to attach a probe", () => {
  test("declines without measuring", () => {
    const { seen, document } = fakeDocument(affine, "none")

    expect(stretchScaleFor(document, "16px Plex", 0, BUDGET)).toBeNull()
    expect(seen.probes.length).toBe(0)
  })

  test("falls back to the root element when there is no body", () => {
    const { seen, document } = fakeDocument(affine, "root")

    expect(stretchScaleFor(document, "16px Plex", 0, BUDGET)).not.toBeNull()
    expect(seen.attached).toBe(0)
  })
})
