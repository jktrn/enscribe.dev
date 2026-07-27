import { cleanCopiedLinebreaks } from "@enscribe/linebreak"
import {
  onJustificationChange,
  onReaderModeChange,
} from "@/lib/typography/preference-events"
import { typesetProse } from "@/lib/typography/prose-linebreaks"

const ROOT_SELECTOR = "[data-typeset-root]"

class ProseJustificationElement extends HTMLElement {
  private teardown: (() => void) | null = null
  private listeners: AbortController | null = null
  private generation = 0

  connectedCallback() {
    this.listeners = new AbortController()
    const { signal } = this.listeners

    onJustificationChange((enabled) => {
      if (enabled) void this.start()
      else this.stop()
    }, signal)
    onReaderModeChange(() => {
      this.stop()
      void this.start()
    }, signal)
    document.addEventListener("copy", cleanCopiedLinebreaks, { signal })

    if (document.documentElement.dataset.textJustification !== "ragged") {
      void this.start()
    }
  }

  disconnectedCallback() {
    this.listeners?.abort()
    this.listeners = null
    this.stop()
  }

  private async start() {
    if (this.teardown) return
    const generation = ++this.generation
    await document.fonts.ready
    if (generation !== this.generation || !this.isConnected) return

    const containers = [
      ...document.querySelectorAll<HTMLElement>(ROOT_SELECTOR),
    ]
    if (containers.length === 0) return
    this.teardown = typesetProse(containers)
  }

  private stop() {
    this.generation += 1
    this.teardown?.()
    this.teardown = null
  }
}

export const defineProseJustification = () => {
  if (!customElements.get("prose-justification")) {
    customElements.define("prose-justification", ProseJustificationElement)
  }
}
