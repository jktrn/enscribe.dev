import type { Advance } from "./segments"

type FaceState = { face: FontFace; descriptor: string }
type WidthCache = {
  faces: FaceState[]
  readonly values: Map<string, number>
  readonly calibrations: Map<string, boolean>
  pixelRatio: number
  characters: number
  epoch: number
}
const documents = new WeakMap<Document, WidthCache>()
const MAX_ENTRIES = 1024
const MAX_CHARACTERS = 65536
const MAX_KEY = 2048
let epoch = 0

export const invalidateNativeWidths = () => { epoch++ }

const clear = (cache: WidthCache) => {
  cache.values.clear()
  cache.calibrations.clear()
  cache.characters = 0
  cache.epoch = epoch
}

const describe = (face: FontFace): string => [
  face.family, face.style, face.weight, face.stretch, face.unicodeRange,
  face.featureSettings, face.variationSettings, face.display,
  face.ascentOverride, face.descentOverride, face.lineGapOverride, face.status,
  (face as FontFace & { sizeAdjust?: string }).sizeAdjust,
  (face as FontFace & { variant?: string }).variant,
].join("\0")

const cacheFor = (document: Document): WidthCache | null => {
  const fonts = document.fonts
  if (!fonts || typeof fonts[Symbol.iterator] !== "function") return null
  const pixelRatio = document.defaultView?.devicePixelRatio ?? 1
  let cache = documents.get(document)
  if (!cache) {
    const created: WidthCache = { faces: [], values: new Map(), calibrations: new Map(), pixelRatio, characters: 0, epoch }
    const changed = () => { clear(created); created.faces = [] }
    fonts.addEventListener("loading", changed)
    fonts.addEventListener("loadingdone", changed)
    fonts.addEventListener("loadingerror", changed)
    documents.set(document, created)
    cache = created
  }
  // Adding an already-loaded face or editing its descriptors need not start a
  // load. Compare identities and descriptors before reusing another owner's data.
  const faces = [...fonts].map(face => ({ face, descriptor: describe(face) }))
  if (cache.epoch !== epoch || cache.pixelRatio !== pixelRatio || cache.faces.length !== faces.length || faces.some((face, index) =>
    cache.faces[index]?.face !== face.face || cache.faces[index]?.descriptor !== face.descriptor)) clear(cache)
  cache.faces = faces
  cache.pixelRatio = pixelRatio
  return cache
}

const retain = (cache: WidthCache, key: string, width: number) => {
  while (cache.values.size >= MAX_ENTRIES || cache.characters + key.length > MAX_CHARACTERS) {
    const oldest = cache.values.keys().next().value
    if (oldest === undefined) break
    cache.values.delete(oldest)
    cache.characters -= oldest.length
  }
  cache.values.set(key, width)
  cache.characters += key.length
}

/** Bounded, document-owned ASCII widths; font loading and explicit resets expire them. */
export const cachedNativeAdvance = (document: Document, fontKey: string, advance: Advance): Advance => {
  const cache = cacheFor(document)
  if (!cache) return advance
  const prefix = `${fontKey}\0`
  return text => {
    if (cache.epoch !== epoch) clear(cache)
    if (document.fonts.status !== "loaded" || /[^\x20-\x7e]/u.test(text)) return advance(text)
    const key = prefix + text
    if (key.length > MAX_KEY) return advance(text)
    const saved = cache.values.get(key)
    if (saved !== undefined) return saved
    const width = advance(text)
    if (Number.isFinite(width)) retain(cache, key, width)
    return width
  }
}

/** A calibrated font can be reused until its document's font state changes. */
export const hasNativeCalibration = (document: Document) =>
  (cacheFor(document)?.calibrations.size ?? 0) > 0

export const cachedNativeCalibration = (document: Document, fontKey: string, verify: () => boolean): boolean => {
  const cache = cacheFor(document)
  if (!cache || document.fonts.status !== "loaded" || fontKey.length > MAX_KEY) return verify()
  const saved = cache.calibrations.get(fontKey)
  if (saved !== undefined) return saved
  const result = verify()
  if (document.fonts.status !== "loaded") return result
  if (cache.calibrations.size >= 32) {
    const oldest = cache.calibrations.keys().next().value
    if (oldest !== undefined) cache.calibrations.delete(oldest)
  }
  cache.calibrations.set(fontKey, result)
  return result
}

/** DOM and native measurements occupy distinct keys in the same bounded budget. */
export const sharedDomWidths = (document: Document, fontKey: string) => {
  const cache = cacheFor(document)
  if (!cache) return null
  const prefix = `\0dom\0${fontKey}\0`
  const keyFor = (text: string) => {
    if (cache.epoch !== epoch) clear(cache)
    if (document.fonts.status !== "loaded" || /[^\x20-\x7e]/u.test(text)) return null
    const key = prefix + text
    return key.length <= MAX_KEY ? key : null
  }
  return {
    get(text: string) {
      const key = keyFor(text)
      return key === null ? undefined : cache.values.get(key)
    },
    set(text: string, width: number) {
      const key = keyFor(text)
      if (key !== null && Number.isFinite(width) && !cache.values.has(key)) retain(cache, key, width)
    },
  }
}
