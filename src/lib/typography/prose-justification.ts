import { cleanCopiedLinebreaks } from "@enscribe/linebreak"
import { onJustificationChange, onReaderModeChange } from "./preference-events"
import { ProseTypesetter } from "./prose-typesetter"

class ProseJustificationElement extends HTMLElement {
  private typesetter: ProseTypesetter | null = null
  private listeners: AbortController | null = null

  connectedCallback() {
    const typesetter = new ProseTypesetter()
    this.typesetter = typesetter
    this.listeners = new AbortController()
    void typesetter.start()

    onJustificationChange(
      (enabled) => typesetter.setEnabled(enabled),
      this.listeners.signal,
    )
    document.addEventListener("copy", cleanCopiedLinebreaks, {
      signal: this.listeners.signal,
    })
    onReaderModeChange(() => typesetter.refreshLayout(), this.listeners.signal)
    document.addEventListener(
      "selectionchange",
      () => {
        if (getSelection()?.isCollapsed) typesetter.refreshAfterSelection()
      },
      { signal: this.listeners.signal },
    )
  }

  disconnectedCallback() {
    this.listeners?.abort()
    this.listeners = null
    this.typesetter?.dispose()
    this.typesetter = null
  }
}

export const defineProseJustification = () => {
  if (!customElements.get("prose-justification")) {
    customElements.define("prose-justification", ProseJustificationElement)
  }
}
