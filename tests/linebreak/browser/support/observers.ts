export class Viewport implements IntersectionObserver {
  static latest: Viewport
  readonly scrollMargin = "0px"
  readonly root = null
  readonly rootMargin: string
  readonly thresholds = [0]
  readonly watched = new Set<Element>()
  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    Viewport.latest = this
    this.rootMargin = options?.rootMargin ?? "0px"
  }
  observe(target: Element) {
    if (!(target instanceof Element)) throw new TypeError("Expected an Element")
    this.watched.add(target)
  }
  unobserve(target: Element) {
    if (!(target instanceof Element)) throw new TypeError("Expected an Element")
    this.watched.delete(target)
  }
  disconnect() {
    this.watched.clear()
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  emit(target: Element, isIntersecting: boolean) {
    const bounds = new DOMRect(0, 0, 300, 20)
    this.callback(
      [
        {
          target,
          isIntersecting,
          time: 0,
          boundingClientRect: bounds,
          intersectionRect: bounds,
          rootBounds: bounds,
          intersectionRatio: isIntersecting ? 1 : 0,
        },
      ],
      this,
    )
  }
}

export class ElementSize implements ResizeObserver {
  static latest: ElementSize
  readonly watched = new Set<Element>()
  constructor(private readonly callback: ResizeObserverCallback) {
    ElementSize.latest = this
  }
  observe(target: Element) {
    if (!(target instanceof Element)) throw new TypeError("Expected an Element")
    this.watched.add(target)
  }
  unobserve(target: Element) {
    if (!(target instanceof Element)) throw new TypeError("Expected an Element")
    this.watched.delete(target)
  }
  disconnect() {
    this.watched.clear()
  }
  emit(target: Element, width: number, boxes: boolean | "legacy" = true, rectWidth = width) {
    const size = { inlineSize: width, blockSize: 20 }
    const entry: ResizeObserverEntry = {
      target,
      contentRect: new DOMRect(0, 0, rectWidth, 20),
      contentBoxSize: boxes === true ? [size] : [],
      borderBoxSize: [size],
      devicePixelContentBoxSize: [size],
    }
    if (boxes === "legacy") Reflect.deleteProperty(entry, "contentBoxSize")
    this.callback(
      [entry],
      this,
    )
  }
}
