import { consoleReporter } from "@enscribe/linebreak"
import { createTypesetter, type Typesetter } from "@enscribe/linebreak/auto"
import { englishHyphenator } from "@enscribe/linebreak/hyphenation"
import {
  onJustificationChange,
  onReaderModeChange,
} from "@/lib/typography/preference-events"
import {
  captureReadingAnchor,
  type ReadingAnchor,
  restoreReadingAnchor,
} from "@/lib/typography/scroll-anchor"

const SKIP = ".expressive-code, h1, h2, h3, h4, h5, h6, summary"

const MEASURES = [
  {
    roots: "[data-linebreak-root]:not([data-linebreak-narrow])",
    minimumWidth: 240,
  },
  { roots: "[data-linebreak-root][data-linebreak-narrow]", minimumWidth: 200 },
]

const justificationEnabled = () =>
  document.documentElement.dataset.textJustification !== "ragged"

class ProseJustificationElement extends HTMLElement {
  #typesetters: Typesetter[] = []
  #listeners: AbortController | null = null

  connectedCallback() {
    this.#listeners = new AbortController()
    const { signal } = this.#listeners

    this.#typesetters = MEASURES.map(({ roots, minimumWidth }) =>
      createTypesetter<ReadingAnchor | null>({
        roots,
        minimumWidth,
        skip: SKIP,
        hyphenate: englishHyphenator,
        preserveImageAttributes: ["data-loaded"],
        beforeWrite: captureReadingAnchor,
        afterWrite: restoreReadingAnchor,
        onOutcome: import.meta.env.DEV ? consoleReporter() : undefined,
        signal,
      }),
    )

    onJustificationChange((enabled) => {
      for (const typesetter of this.#typesetters) {
        if (enabled) void typesetter.start()
        else typesetter.stop()
      }
    }, signal)
    onReaderModeChange(() => {
      for (const typesetter of this.#typesetters) typesetter.refresh()
    }, signal)

    if (justificationEnabled()) {
      for (const typesetter of this.#typesetters) void typesetter.start()
    }
  }

  rescan() {
    if (!justificationEnabled()) return
    for (const typesetter of this.#typesetters) {
      void typesetter.start().then(() => typesetter.rescan())
    }
  }

  disconnectedCallback() {
    this.#listeners?.abort()
    this.#listeners = null
    this.#typesetters = []
  }
}

export const defineProseJustification = () => {
  if (!customElements.get("prose-justification")) {
    customElements.define("prose-justification", ProseJustificationElement)
  }
}

export const rescanProse = () => {
  const element = document.querySelector("prose-justification")
  if (element instanceof ProseJustificationElement) element.rescan()
}
