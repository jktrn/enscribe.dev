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

/**
 * Content the engine could model but this site does not want justified:
 * Expressive Code blocks, headings, and disclosure summaries.
 */
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
      // Rewriting a paragraph changes its height, so hold the reader's place
      // across every write — including restores, which the toggle triggers.
      beforeWrite: captureReadingAnchor,
      afterWrite: restoreReadingAnchor,
      onOutcome: import.meta.env.DEV ? consoleReporter() : undefined,
      signal,
    })

    onJustificationChange((enabled) => {
      if (enabled) void this.#typesetter?.start()
      else this.#typesetter?.stop()
    }, signal)
    // Reader mode changes the measure, so re-solve; do not restart, which
    // would ignore the reader's justification preference.
    onReaderModeChange(() => this.#typesetter?.refresh(), signal)

    if (justificationEnabled()) void this.#typesetter.start()
  }

  disconnectedCallback() {
    // Aborting also disposes the typesetter, which restores every paragraph.
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
