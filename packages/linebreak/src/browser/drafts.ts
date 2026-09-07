import type { Composition } from "../types"
import type { Draft } from "./state"
import { contentKey } from "./cache"
import { computedFont, variantKey } from "../dom/style"

type Pending = { draft: Draft | null; content: string; style: string }

const styleKey = (element: HTMLElement) => {
  const style = getComputedStyle(element)
  return JSON.stringify([
    computedFont(style),
    variantKey(style),
    style.letterSpacing,
    style.textIndent,
    style.wordSpacing,
    style.textTransform,
    style.direction,
    style.writingMode,
    style.whiteSpace,
    element.closest("[lang]")?.getAttribute("lang"),
  ])
}

/** A composition is a single-use snapshot, superseded by new work or restoration. */
export class Drafts {
  private readonly pending = new WeakMap<Composition, Pending>()
  private latest = new WeakMap<HTMLElement, Composition>()

  constructor(private readonly preservedImageAttributes: readonly string[]) {}

  set(composition: Composition, draft: Draft | null = null) {
    this.latest.set(composition.element, composition)
    this.pending.set(composition, {
      draft,
      content: contentKey(composition.element, this.preservedImageAttributes),
      style: styleKey(composition.element),
    })
  }

  get(composition: Composition) {
    const pending = this.pending.get(composition)
    if (!pending) return undefined
    if (
      this.latest.get(composition.element) !== composition ||
      pending.content !==
        contentKey(composition.element, this.preservedImageAttributes) ||
      pending.style !== styleKey(composition.element)
    ) {
      throw new TypeError("linebreak: this composition is stale; compose again")
    }
    return pending.draft
  }

  delete(composition: Composition) {
    this.pending.delete(composition)
  }

  invalidate(element: HTMLElement) {
    this.latest.delete(element)
  }

  clear() {
    this.latest = new WeakMap()
  }
}
