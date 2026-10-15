import { TYPESET_ATTRIBUTE } from "../dom/render"
import { restoreAuthored } from "../dom/restore"
import type { Measurement, MeasurementBasis } from "./state"

export const contentKey = (
  element: HTMLElement,
  preservedImageAttributes: readonly string[],
) => {
  if (preservedImageAttributes.length === 0) return element.innerHTML
  const copy = element.cloneNode(true) as HTMLElement
  for (const image of copy.querySelectorAll("img")) {
    for (const attribute of preservedImageAttributes)
      image.removeAttribute(attribute)
  }
  return copy.innerHTML
}

const sameBasis = (a: MeasurementBasis, b: MeasurementBasis) =>
  a.locale === b.locale &&
  a.font === b.font &&
  a.letterSpacing === b.letterSpacing &&
  a.variant === b.variant

type Cached = { measurement: Measurement; content: string }

/** Keep authored content only while the DOM still matches our last write. */
export class BrowserCache {
  private entries = new WeakMap<HTMLElement, Cached>()

  constructor(
    private readonly live: Set<HTMLElement>,
    private readonly preservedImageAttributes: readonly string[],
  ) {}

  get(element: HTMLElement, basis: MeasurementBasis) {
    const cached = this.entries.get(element)
    if (!cached) return undefined
    if (
      this.unchanged(element, cached) &&
      sameBasis(cached.measurement.under, basis)
    ) {
      return cached.measurement
    }
    this.restore(element)
    this.entries.delete(element)
    return undefined
  }

  set(element: HTMLElement, measurement: Measurement) {
    this.entries.set(element, {
      measurement,
      content: contentKey(element, this.preservedImageAttributes),
    })
  }

  delete(element: HTMLElement) {
    this.entries.delete(element)
  }

  clear() {
    this.entries = new WeakMap()
  }

  written(element: HTMLElement) {
    // Only a measured element can be rendered by this controller.
    const cached = this.entries.get(element) as Cached
    cached.content = contentKey(element, this.preservedImageAttributes)
  }

  private unchanged(element: HTMLElement, cached: Cached) {
    return cached.content === contentKey(element, this.preservedImageAttributes)
  }

  restore(element: HTMLElement, force = false) {
    this.live.delete(element)
    const cached = this.entries.get(element)
    if (!cached) return
    if (!force && !this.unchanged(element, cached)) {
      this.entries.delete(element)
      element.removeAttribute(TYPESET_ATTRIBUTE)
      return
    }
    restoreAuthored(
      element,
      cached.measurement.authored,
      this.preservedImageAttributes,
    )
    cached.content = contentKey(element, this.preservedImageAttributes)
  }
}
