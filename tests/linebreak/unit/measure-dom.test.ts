import { describe, expect, test } from "bun:test"

class StubContext {
  font = ""
  measureText(text: string) {
    return { width: [...text].length * 6.5 }
  }
}

class StubOffscreenCanvas {
  getContext(_kind: string) {
    return new StubContext()
  }
}

;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
  StubOffscreenCanvas

const { domWidths, metricsForStyle } = await import("@linebreak/dom/measure-dom")

const ADVANCE = 7

type Probe = {
  readonly style: Record<string, string>
  readonly attribute: Record<string, string>
  text: string
  appendedAt: number
  readAt: number
}

type Recorder = {
  readonly probes: Probe[]
  readonly hosts: Probe[]
  attached: number
  clock: number
}

const fakeDocument = (host: "body" | "root" | "none" = "body") => {
  const seen: Recorder = { probes: [], hosts: [], attached: 0, clock: 0 }

  const element = (): Probe & Record<string, unknown> => {
    const record: Probe = {
      style: {},
      attribute: {},
      text: "",
      appendedAt: -1,
      readAt: -1,
    }
    return {
      ...record,
      style: record.style,
      setAttribute: (name: string, value: string) => {
        record.attribute[name] = value
      },
      set textContent(value: string) {
        record.text = value
      },
      append: (child: { seat: Probe }) => {
        child.seat.appendedAt = seen.clock
        seen.clock += 1
      },
      remove: () => {
        seen.attached -= 1
      },
      getBoundingClientRect: () => {
        record.readAt = seen.clock
        seen.clock += 1
        return { width: record.text.length * ADVANCE }
      },
      seat: record,
    }
  }

  const root = {
    append: (child: { seat: Probe }) => {
      seen.hosts.push(child.seat)
      child.seat.appendedAt = seen.clock
      seen.clock += 1
      seen.attached += 1
    },
  }

  const document = {
    createElement: (tag: string) => {
      const node = element()
      if (tag === "span") seen.probes.push(node.seat)
      return node
    },
    ...(host === "body" ? { body: root } : {}),
    ...(host === "root" ? { documentElement: root } : {}),
  }

  return { seen, document: document as unknown as Document }
}

const styleOf = (overrides: Partial<Record<string, string>> = {}) =>
  ({
    letterSpacing: "0px",
    fontStretch: "100%",
    fontVariationSettings: "normal",
    fontVariantAlternates: "normal",
    fontVariantCaps: "normal",
    fontVariantEastAsian: "normal",
    fontVariantLigatures: "normal",
    fontVariantNumeric: "normal",
    fontVariantPosition: "normal",
    fontFeatureSettings: "normal",
    ...overrides,
  }) as unknown as CSSStyleDeclaration

const PLAIN = [
  ["fontStretch", "100%"],
  ["fontVariationSettings", "normal"],
  ["fontVariantAlternates", "normal"],
  ["fontVariantCaps", "normal"],
  ["fontVariantEastAsian", "normal"],
  ["fontVariantLigatures", "normal"],
  ["fontVariantNumeric", "normal"],
  ["fontVariantPosition", "normal"],
  ["fontFeatureSettings", "normal"],
] as const

describe("a document that cannot host a probe", () => {
  test("no width source is offered", () => {
    const { document } = fakeDocument("none")

    expect(domWidths(document, "16px Lorien", 0, PLAIN)).toBeNull()
  })

  test("the run is left unmeasured rather than guessed at", () => {
    const { document } = fakeDocument("none")

    expect(
      metricsForStyle(
        document,
        styleOf({ fontVariantCaps: "all-small-caps" }),
        "16px Lorien",
        0,
      ),
    ).toBeNull()
  })

  test("the root element will do when there is no body", () => {
    const { document, seen } = fakeDocument("root")

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["ab"])

    expect(seen.probes[0]?.readAt).toBeGreaterThan(-1)
  })
})

describe("one layout for the whole batch", () => {
  test("every probe is appended before the first width is read", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["a", "bb", "ccc"])

    const lastAppend = Math.max(...seen.probes.map((probe) => probe.appendedAt))
    const firstRead = Math.min(...seen.probes.map((probe) => probe.readAt))
    expect(seen.probes.length).toBe(3)
    expect(firstRead).toBeGreaterThan(lastAppend)
  })

  test("the batch is one host, attached once", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["a", "bb", "ccc"])

    expect(seen.hosts.length).toBe(1)
    expect(seen.hosts[0]?.attribute["aria-hidden"]).toBe("true")
  })

  test("the host leaves the document as it found it", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["a", "bb"])

    expect(seen.attached).toBe(0)
  })

  test("a repeated string is measured once", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["a", "a", "a"])

    expect(seen.probes.length).toBe(1)
  })

  test("a warmed string is not measured again", () => {
    const { document, seen } = fakeDocument()
    const source = domWidths(document, "16px Lorien", 0, PLAIN)

    source?.warm(["a", "bb"])
    source?.warm(["a", "bb"])

    expect(seen.probes.length).toBe(2)
    expect(seen.hosts.length).toBe(1)
  })

  test("an empty string costs no probe", () => {
    const { document, seen } = fakeDocument()
    const source = domWidths(document, "16px Lorien", 0, PLAIN)

    expect(source?.advance("")).toBe(0)
    expect(seen.probes.length).toBe(0)
  })
})

describe("the probe stands for the run it measures", () => {
  test("it carries the run's font, spacing and every variant property", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "italic 700 18px/1.5 Plex", 0.25, [
      ...PLAIN.slice(0, 2),
      ["fontVariantAlternates", "normal"],
      ["fontVariantCaps", "all-small-caps"],
      ["fontVariantEastAsian", "normal"],
      ["fontVariantLigatures", "none"],
      ["fontVariantNumeric", "oldstyle-nums"],
      ["fontVariantPosition", "super"],
      ["fontFeatureSettings", '"smcp"'],
    ])?.warm(["ab"])

    const probe = seen.probes[0] as Probe
    expect(probe.style.font).toBe("italic 700 18px/1.5 Plex")
    expect(probe.style.letterSpacing).toBe("0.25px")
    expect(probe.style.fontVariantCaps).toBe("all-small-caps")
    expect(probe.style.fontVariantLigatures).toBe("none")
    expect(probe.style.fontVariantNumeric).toBe("oldstyle-nums")
    expect(probe.style.fontVariantPosition).toBe("super")
    expect(probe.style.fontFeatureSettings).toBe('"smcp"')
    expect(probe.style.cssText).toContain("white-space:pre")
  })

  test("a normal value is written too, so the host cannot inherit one", () => {
    const { document, seen } = fakeDocument()

    domWidths(document, "16px Lorien", 0, PLAIN)?.warm(["ab"])

    const probe = seen.probes[0] as Probe
    expect(probe.style.fontVariantCaps).toBe("normal")
    expect(probe.style.fontFeatureSettings).toBe("normal")
  })

  test("a miss outside a batch still answers", () => {
    const { document, seen } = fakeDocument()
    const source = domWidths(document, "16px Lorien", 0, PLAIN)

    expect(source?.advance("abcd")).toBe(4 * ADVANCE)
    expect(seen.probes.length).toBe(1)
    expect(source?.advance("abcd")).toBe(4 * ADVANCE)
    expect(seen.probes.length).toBe(1)
  })
})

describe("which runs reach the DOM at all", () => {
  test("a plain run is measured without touching the document", () => {
    const { document, seen } = fakeDocument()

    const metrics = metricsForStyle(document, styleOf(), "16px Lorien", 0)

    expect(metrics).not.toBeNull()
    expect(seen.probes.length).toBe(0)
  })

  test("a variant run is measured through the probe", () => {
    const { document, seen } = fakeDocument()

    const metrics = metricsForStyle(
      document,
      styleOf({ fontVariantNumeric: "oldstyle-nums ordinal" }),
      "16px Lorien",
      0,
    )

    expect(metrics?.measureRun("August")).toBe(6 * ADVANCE)
    expect(seen.probes[0]?.style.fontVariantNumeric).toBe(
      "oldstyle-nums ordinal",
    )
  })

  test("the hyphen the compiler draws is measured through it as well", () => {
    const { document } = fakeDocument()

    const metrics = metricsForStyle(
      document,
      styleOf({ fontVariantCaps: "small-caps" }),
      "16px Lorien",
      0,
    )

    expect(metrics?.hyphenWidth).toBe(ADVANCE)
  })

  test("a paragraph's segments are measured in one batch", () => {
    const { document, seen } = fakeDocument()

    const metrics = metricsForStyle(
      document,
      styleOf({ fontVariantCaps: "small-caps" }),
      "16px Lorien",
      0,
    )
    const paragraph = metrics?.measureParagraph("one two three")

    expect(paragraph?.segments.length).toBeGreaterThan(1)
    expect(seen.hosts.length).toBe(2)
    for (const segment of paragraph?.segments ?? []) {
      expect(segment.width).toBe(segment.text.length * ADVANCE)
    }
  })
})
