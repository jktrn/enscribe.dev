import { consoleReporter } from "@enscribe/linebreak"
import { createTypesetter, type Typesetter } from "@enscribe/linebreak/auto"
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

const justificationEnabled = () =>
  document.documentElement.dataset.textJustification !== "ragged"

class ProseJustificationElement extends HTMLElement {
  #typesetter: Typesetter | null = null
  #listeners: AbortController | null = null

  connectedCallback() {
    this.#listeners = new AbortController()
    const { signal } = this.#listeners

    this.#typesetter = createTypesetter<ReadingAnchor | null>({
      skip: SKIP,
      minimumWidth: 240,
      hyphenate: true,
      preserveImageAttributes: ["data-loaded"],
      beforeWrite: captureReadingAnchor,
      afterWrite: restoreReadingAnchor,
      onOutcome: import.meta.env.DEV ? consoleReporter() : undefined,
      signal,
    })

    onJustificationChange((enabled) => {
      if (enabled) void this.#typesetter?.start()
      else this.#typesetter?.stop()
    }, signal)
    onReaderModeChange(() => this.#typesetter?.refresh(), signal)

    if (justificationEnabled()) void this.#typesetter.start()
  }

  disconnectedCallback() {
    this.#listeners?.abort()
    this.#listeners = null
    this.#typesetter = null
  }
}

export const defineProseJustification = () => {
  if (!customElements.get("prose-justification")) {
    customElements.define("prose-justification", ProseJustificationElement)
  }
}
