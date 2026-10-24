import { type Controller, justify } from "linaire"
import en from "linaire/hyphenate/en-us"
import {
  onJustificationChange,
  onReaderModeChange,
} from "@/lib/typography/preference-events"
import {
  captureReadingAnchor,
  restoreReadingAnchor,
} from "@/lib/typography/scroll-anchor"

const ROOTS = "[data-prose-root]"

const WIDE = { hyphenate: en }
const NARROW = { hyphenate: en, tolerance: 400 }

const justificationEnabled = () =>
  document.documentElement.dataset.textJustification !== "ragged"

class ProseJustificationElement extends HTMLElement {
  #controllers = new Map<Element, Controller>()
  #listeners: AbortController | null = null

  connectedCallback() {
    this.#listeners = new AbortController()
    const { signal } = this.#listeners

    onJustificationChange((enabled) => {
      this.#relayout(() => (enabled ? this.#start() : this.#stop()))
    }, signal)
    onReaderModeChange(() => {
      this.#relayout(() => {
        for (const controller of this.#controllers.values()) {
          controller.refresh()
        }
      })
    }, signal)
    addEventListener("beforeprint", () => this.#stop(), { signal })
    addEventListener("afterprint", () => this.rescan(), { signal })

    if (justificationEnabled()) this.#relayout(() => this.#start())
  }

  rescan() {
    if (!justificationEnabled()) return
    this.#relayout(() => {
      this.#stop()
      this.#start()
    })
  }

  restore() {
    this.#relayout(() => this.#stop())
  }

  typesetWithin(root: Element) {
    if (!justificationEnabled() || !root.matches(ROOTS)) return
    this.#relayout(() => this.#justify(root))
  }

  disconnectedCallback() {
    this.#listeners?.abort()
    this.#listeners = null
    this.#stop()
  }

  #start() {
    for (const root of document.querySelectorAll(ROOTS)) this.#justify(root)
  }

  #stop() {
    for (const controller of this.#controllers.values()) controller.destroy()
    this.#controllers.clear()
  }

  #justify(root: Element) {
    this.#controllers.get(root)?.destroy()
    const options = root.hasAttribute("data-prose-narrow") ? NARROW : WIDE
    this.#controllers.set(root, justify(root, options))
  }

  #relayout(change: () => void) {
    const anchor = captureReadingAnchor()
    change()
    const settled = [...this.#controllers.values()].map(({ ready }) => ready)
    void Promise.all(settled).then(() => restoreReadingAnchor(anchor))
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

export const restoreProse = () => {
  const element = document.querySelector("prose-justification")
  if (element instanceof ProseJustificationElement) element.restore()
}

export const typesetNow = (root: Element) => {
  const element = document.querySelector("prose-justification")
  if (element instanceof ProseJustificationElement) element.typesetWithin(root)
}
