import { createLinebreaker } from "@enscribe/linebreak"
import { elements, linebreaker } from "../state"
import {
  copyHyphenated,
  geometrySnapshot,
  ownerSnapshot,
  resultSnapshot,
} from "../snapshots"

const restoreDocumentLanguage = (language: string | null) => {
  if (language === null) {
    document.documentElement.removeAttribute("lang")
  } else {
    document.documentElement.setAttribute("lang", language)
  }
}

export const layoutScenarios = {
  fallbackResults() {
    return linebreaker
      .typeset([elements.rtl, elements.hardBreak, elements.narrow])
      .map(resultSnapshot)
  },
  intrinsicTable() {
    const tableLinebreaker = createLinebreaker({ minimumWidth: 180 })
    try {
      const results = tableLinebreaker
        .typeset([elements.intrinsicHeader, elements.intrinsicCell])
        .map(resultSnapshot)
      return {
        results,
        header: ownerSnapshot(elements.intrinsicHeader),
        cell: ownerSnapshot(elements.intrinsicCell),
      }
    } finally {
      tableLinebreaker.destroy()
    }
  },
  minimumWidthAfterRender() {
    const html = elements.minimumShrink.innerHTML
    Object.defineProperty(elements.minimumShrink, "clientWidth", {
      configurable: true,
      get: () =>
        elements.minimumShrink.hasAttribute("data-kp-justified") ? 160 : 300,
    })
    Object.defineProperty(elements.minimumShrink, "scrollWidth", {
      configurable: true,
      get: () => elements.minimumShrink.clientWidth,
    })
    const minimumLinebreaker = createLinebreaker({ minimumWidth: 180 })
    try {
      const result = resultSnapshot(
        minimumLinebreaker.typeset(elements.minimumShrink),
      )
      return {
        authored: elements.minimumShrink.innerHTML === html,
        result,
        typeset: elements.minimumShrink.hasAttribute("data-kp-justified"),
      }
    } finally {
      minimumLinebreaker.destroy()
      Reflect.deleteProperty(elements.minimumShrink, "clientWidth")
      Reflect.deleteProperty(elements.minimumShrink, "scrollWidth")
    }
  },
  settlementRevalidation() {
    const html = elements.settlementOwner.innerHTML
    Object.defineProperty(elements.settlementOwner, "clientWidth", {
      configurable: true,
      get: () =>
        elements.settlementFailing.hasAttribute("data-kp-justified")
          ? 320
          : 260,
    })
    Object.defineProperty(elements.settlementOwner, "scrollWidth", {
      configurable: true,
      get: () => elements.settlementOwner.clientWidth,
    })
    Object.defineProperty(elements.settlementFailing, "clientWidth", {
      configurable: true,
      get: () => 300,
    })
    Object.defineProperty(elements.settlementFailing, "scrollWidth", {
      configurable: true,
      get: () =>
        elements.settlementFailing.clientWidth +
        (elements.settlementFailing.hasAttribute("data-kp-justified") ? 2 : 0),
    })
    const settlementLinebreaker = createLinebreaker({ minimumWidth: 180 })
    try {
      const results = settlementLinebreaker
        .typeset([elements.settlementOwner, elements.settlementFailing])
        .map(resultSnapshot)
      return {
        authored: elements.settlementOwner.innerHTML === html,
        results,
        typeset: elements.settlementOwner.hasAttribute("data-kp-justified"),
      }
    } finally {
      settlementLinebreaker.destroy()
      for (const element of [
        elements.settlementOwner,
        elements.settlementFailing,
      ]) {
        Reflect.deleteProperty(element, "clientWidth")
        Reflect.deleteProperty(element, "scrollWidth")
      }
    }
  },
  stabilizationFailureIsolation() {
    const stable = elements.rich
    const failing = elements.stale
    const errors: Array<{ element: string; message: string; phase: string }> =
      []
    const isolatedLinebreaker = createLinebreaker({
      minimumWidth: 180,
      onError({ cause, element, phase }) {
        errors.push({
          element: element.id,
          message: cause instanceof Error ? cause.message : String(cause),
          phase,
        })
      },
    })
    const plans = [
      isolatedLinebreaker.plan(stable),
      isolatedLinebreaker.plan(failing),
    ]
    Object.defineProperty(failing, "scrollWidth", {
      configurable: true,
      get: () => {
        throw new Error("forced post-render geometry failure")
      },
    })

    try {
      return {
        errors,
        results: isolatedLinebreaker.commit(plans).map(resultSnapshot),
        stableTypeset: stable.hasAttribute("data-kp-justified"),
        failingTypeset: failing.hasAttribute("data-kp-justified"),
      }
    } finally {
      Reflect.deleteProperty(failing, "scrollWidth")
      isolatedLinebreaker.destroy()
    }
  },
  localeFallback() {
    const documentLanguage = document.documentElement.getAttribute("lang")
    document.documentElement.removeAttribute("lang")
    const localeLinebreaker = createLinebreaker({
      locale: "th",
      minimumWidth: 180,
    })
    try {
      const result = resultSnapshot(
        localeLinebreaker.typeset(elements.localeOwner),
      )
      return { result, ...ownerSnapshot(elements.localeOwner) }
    } finally {
      localeLinebreaker.destroy()
      restoreDocumentLanguage(documentLanguage)
    }
  },
  localeSwitching() {
    const documentLanguage = document.documentElement.getAttribute("lang")
    const segmenterDescriptor = Object.getOwnPropertyDescriptor(
      Intl,
      "Segmenter",
    )
    const OriginalSegmenter = Intl.Segmenter
    const locales: string[] = []
    class RecordingSegmenter extends OriginalSegmenter {
      constructor(...args: ConstructorParameters<typeof Intl.Segmenter>) {
        super(...args)
        if (args[1]?.granularity === "word") {
          locales.push(this.resolvedOptions().locale)
        }
      }
    }
    Object.defineProperty(Intl, "Segmenter", {
      ...segmenterDescriptor,
      value: RecordingSegmenter,
    })
    document.documentElement.removeAttribute("lang")
    const french = createLinebreaker({ locale: "fr", minimumWidth: 180 })
    const thai = createLinebreaker({ locale: "th", minimumWidth: 180 })
    try {
      const first = resultSnapshot(french.typeset(elements.foreign))
      const second = resultSnapshot(thai.typeset(elements.localeOwner))
      french.invalidate(elements.foreign)
      const third = resultSnapshot(french.typeset(elements.foreign))
      return { locales, results: [first, second, third] }
    } finally {
      french.destroy()
      thai.destroy()
      if (segmenterDescriptor) {
        Object.defineProperty(Intl, "Segmenter", segmenterDescriptor)
      }
      restoreDocumentLanguage(documentLanguage)
    }
  },
  diagnosticIsolation() {
    const originalGetComputedStyle = window.getComputedStyle
    const diagnosticLinebreaker = createLinebreaker({
      onError() {
        throw new Error("diagnostic callback failure")
      },
    })
    window.getComputedStyle = (() => {
      throw new Error("forced measurement failure")
    }) as typeof window.getComputedStyle
    try {
      return resultSnapshot(diagnosticLinebreaker.typeset(elements.foreign))
    } finally {
      window.getComputedStyle = originalGetComputedStyle
      diagnosticLinebreaker.destroy()
    }
  },
  typesetGeometry() {
    const before = geometrySnapshot()
    const result = linebreaker.typeset(elements.geometry)
    return { before, result: resultSnapshot(result), after: geometrySnapshot() }
  },
  authoredSpacing() {
    const authored = getComputedStyle(elements.spacingNative)
    const result = linebreaker.typeset(elements.spacing)
    const lines = [
      ...elements.spacing.querySelectorAll<HTMLElement>(":scope > .kp-line"),
    ]
    const base = {
      letter: Number.parseFloat(authored.letterSpacing),
      word: Number.parseFloat(authored.wordSpacing),
    }
    const compositionErrors = lines.map((line) => {
      const computed = getComputedStyle(line)
      return {
        letter: Math.abs(
          Number.parseFloat(computed.letterSpacing) -
            base.letter -
            (Number.parseFloat(
              line.style.getPropertyValue("--kp-letter-spacing-delta"),
            ) || 0),
        ),
        word: Math.abs(
          Number.parseFloat(computed.wordSpacing) -
            base.word -
            (Number.parseFloat(
              line.style.getPropertyValue("--kp-word-spacing-delta"),
            ) || 0),
        ),
      }
    })
    const finalStyle = getComputedStyle(lines.at(-1)!)

    return {
      result: resultSnapshot(result),
      lineCount: lines.length,
      lineHeight: finalStyle.lineHeight,
      nativeLineHeight: authored.lineHeight,
      pitch:
        lines.length > 1
          ? lines[1].getBoundingClientRect().top -
            lines[0].getBoundingClientRect().top
          : 0,
      base,
      final: {
        letter: Number.parseFloat(finalStyle.letterSpacing),
        word: Number.parseFloat(finalStyle.wordSpacing),
      },
      maximumCompositionError: Math.max(
        0,
        ...compositionErrors.flatMap(({ letter, word }) => [letter, word]),
      ),
      overflow: elements.spacing.scrollWidth - elements.spacing.clientWidth,
    }
  },
  preformattedCodeFallback() {
    const owners = [
      elements.preCode,
      elements.preWrapCode,
      elements.preservedWhitespace,
    ]
    const html = owners.map((owner) => owner.innerHTML)
    const results = linebreaker.typeset(owners).map(resultSnapshot)
    return owners.map((owner, index) => ({
      authored: owner.innerHTML === html[index],
      result: results[index],
      typeset: owner.hasAttribute("data-kp-justified"),
    }))
  },
  nowrapInlineLayout() {
    const owner = elements.nowrap
    const authored = owner.innerHTML
    const result = resultSnapshot(linebreaker.typeset(owner))
    const lines = [...owner.querySelectorAll<HTMLElement>(":scope > .kp-line")]
    const fragments = [...owner.querySelectorAll<HTMLElement>(".nowrap-range")]
    const fragment = fragments[0]
    const fragmentLine = fragment?.closest<HTMLElement>(".kp-line")
    const snapshot = {
      result,
      typeset: owner.hasAttribute("data-kp-justified"),
      lineCount: lines.length,
      lineIndex: fragmentLine ? lines.indexOf(fragmentLine) : -1,
      fragments: fragments.length,
      fragmentRects: fragments.reduce(
        (total, fragment) => total + fragment.getClientRects().length,
        0,
      ),
      fragmentStart: fragment?.hasAttribute("data-kp-fragment-start") ?? false,
      fragmentEnd: fragment?.hasAttribute("data-kp-fragment-end") ?? false,
      overflow: owner.scrollWidth - owner.clientWidth,
    }
    linebreaker.restore(owner)
    return { ...snapshot, restored: owner.innerHTML === authored }
  },
  nowrapOwnershipLayouts() {
    const owners = [
      elements.nowrapAtomic,
      elements.nowrapCollapsed,
      elements.nowrapSpace,
      elements.nowrapEmptyInline,
    ]
    const authored = owners.map((owner) => owner.innerHTML)
    const ownershipLinebreaker = createLinebreaker({ minimumWidth: 0 })
    try {
      const results = ownershipLinebreaker.typeset(owners)
      const snapshots = owners.map((owner, index) => {
        return {
          result: resultSnapshot(results[index]),
          typeset: owner.hasAttribute("data-kp-justified"),
          overflow: owner.scrollWidth - owner.clientWidth,
        }
      })
      const [atomic, collapsed, trailingSpace, emptyInline] = snapshots
      ownershipLinebreaker.restore(owners)
      return {
        atomic,
        collapsed,
        trailingSpace,
        emptyInline,
        restored: owners.every(
          (owner, index) => owner.innerHTML === authored[index],
        ),
      }
    } finally {
      ownershipLinebreaker.destroy()
    }
  },
  async nowrapEdgeLayouts() {
    await document.fonts.load('20px "Linebreak Typography Contract"')
    const owners = [elements.nowrapEdgeSole, elements.nowrapEdgeDuplicate]
    const authored = owners.map((owner) => owner.innerHTML)
    const nativeWidths = owners.map(
      (owner) =>
        owner
          .querySelector<HTMLElement>(".nowrap-edge")
          ?.getBoundingClientRect().width ?? 0,
    )
    const edgeLinebreaker = createLinebreaker({ minimumWidth: 0 })
    try {
      const results = edgeLinebreaker.typeset(owners)
      const snapshots = owners.map((owner, index) => {
        const lines = [
          ...owner.querySelectorAll<HTMLElement>(":scope > .kp-line"),
        ]
        const edge = owner.querySelector<HTMLElement>(".nowrap-edge")
        const line = edge?.closest<HTMLElement>(".kp-line")
        return {
          result: resultSnapshot(results[index]),
          edgeLine: line ? lines.indexOf(line) : -1,
          edgeWidth: edge?.getBoundingClientRect().width ?? 0,
          nativeEdgeWidth: nativeWidths[index],
          overflow: owner.scrollWidth - owner.clientWidth,
        }
      })
      edgeLinebreaker.restore(owners)
      return {
        sole: snapshots[0],
        duplicate: snapshots[1],
        restored: owners.every(
          (owner, index) => owner.innerHTML === authored[index],
        ),
      }
    } finally {
      edgeLinebreaker.destroy()
    }
  },
  typesetHyphen() {
    const sourceText = (elements.hyphen.textContent ?? "")
      .replace(/\s+/gu, " ")
      .trim()
    const result = linebreaker.typeset(elements.hyphen)
    return {
      result: resultSnapshot(result),
      sourceText,
      selectedHyphens: elements.hyphen.querySelectorAll(".kp-hyphen").length,
      codeHyphens: elements.hyphen.querySelectorAll("code .kp-hyphen").length,
      copy: copyHyphenated(),
    }
  },
  typesetNonEnglishHyphen() {
    const owner = elements.nonEnglishHyphen
    const languageOwner = elements.nonEnglishHyphenLanguage
    const documentElement = owner.ownerDocument.documentElement
    const authoredDocumentLanguage = documentElement.getAttribute("lang")
    const results = []

    languageOwner.lang = "en"
    results.push(linebreaker.typeset(owner))
    const ancestorEnglishHyphens = owner.querySelectorAll(".kp-hyphen").length

    languageOwner.lang = "fr"
    results.push(linebreaker.typeset(owner))
    const ancestorFrenchHyphens = owner.querySelectorAll(".kp-hyphen").length

    languageOwner.removeAttribute("lang")
    documentElement.lang = "en"
    results.push(linebreaker.typeset(owner))
    const documentEnglishHyphens = owner.querySelectorAll(".kp-hyphen").length

    documentElement.lang = ""
    results.push(linebreaker.typeset(owner))
    const documentUnknownHyphens = owner.querySelectorAll(".kp-hyphen").length

    owner.lang = "en"
    results.push(linebreaker.typeset(owner))
    const elementEnglishHyphens = owner.querySelectorAll(".kp-hyphen").length

    owner.lang = ""
    results.push(linebreaker.typeset(owner))
    const elementUnknownHyphens = owner.querySelectorAll(".kp-hyphen").length

    linebreaker.invalidate(owner)
    owner.removeAttribute("lang")
    languageOwner.lang = "fr"
    restoreDocumentLanguage(authoredDocumentLanguage)

    return {
      ancestorEnglishHyphens,
      ancestorFrenchHyphens,
      documentEnglishHyphens,
      documentUnknownHyphens,
      elementEnglishHyphens,
      elementUnknownHyphens,
      results: results.map(resultSnapshot),
    }
  },
}
