import { createLinebreaker, type LinebreakPlan } from "@enscribe/linebreak"
import { byId } from "./dom"

export const elements = {
  rich: byId("rich-owner"),
  japanese: byId("japanese-owner"),
  stale: byId("stale-owner"),
  foreign: byId("foreign-owner"),
  duplicate: byId("duplicate-owner"),
  imageOwner: byId("image-owner"),
  intrinsicHeader: byId("intrinsic-header"),
  intrinsicCell: byId("intrinsic-cell"),
  localeOwner: byId("locale-owner"),
  minimumShrink: byId("minimum-shrink-owner"),
  settlementOwner: byId("settlement-owner"),
  settlementFailing: byId("settlement-failing"),
  geometry: byId("geometry-owner"),
  geometryNative: byId("geometry-native"),
  spacing: byId("spacing-owner"),
  spacingNative: byId("spacing-native"),
  hyphen: byId("hyphen-owner"),
  nonEnglishHyphenLanguage: byId("non-english-hyphen-language"),
  nonEnglishHyphen: byId("non-english-hyphen-owner"),
  rtl: byId("rtl-owner"),
  hardBreak: byId("break-owner"),
  narrow: byId("narrow-owner"),
  preCode: byId("pre-code-owner"),
  preWrapCode: byId("pre-wrap-code-owner"),
  preservedWhitespace: byId("preserved-whitespace-owner"),
  nowrap: byId("nowrap-owner"),
  nowrapAtomic: byId("nowrap-atomic-owner"),
  nowrapCollapsed: byId("nowrap-collapsed-owner"),
  nowrapSpace: byId("nowrap-space-owner"),
  nowrapEmptyInline: byId("nowrap-empty-inline-owner"),
  nowrapEdgeSole: byId("nowrap-edge-sole-owner"),
  nowrapEdgeDuplicate: byId("nowrap-edge-duplicate-owner"),
}

export const authored = {
  richHtml: elements.rich.innerHTML,
  richText: elements.rich.textContent ?? "",
  staleHtml: elements.stale.innerHTML,
  link: byId("semantic-link"),
}

export const errors: string[] = []

export const linebreaker = createLinebreaker({
  locale: "en-US",
  minimumWidth: 180,
  preserveImageAttributes: ["data-loaded"],
  onError({ cause }) {
    errors.push(cause instanceof Error ? cause.message : String(cause))
  },
})

export const plans: {
  batch: LinebreakPlan[]
  stale: LinebreakPlan | null
} = {
  batch: [],
  stale: null,
}
