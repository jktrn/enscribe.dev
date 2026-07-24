import { inlineAcronyms } from "./acronyms"
import { calloutDirective } from "./callout"
import { contentDirectives } from "./directives"
import { blockExpressiveCode, inlineExpressiveCode } from "./expressive-code"
import { externalLinks } from "./external-links"
import { frontmatterInline } from "./frontmatter-inline"
import { headingAnchors } from "./heading-anchors"
import { inlineSvg } from "./inline-svg"
import { linkFavicons } from "./link-favicons"
import {
  loosenRichListItems,
  normalizeListItemFlow,
} from "./normalize-list-items"
import { normalizeTabPanels } from "./normalize-tab-panels"
import { parentheticalTypography } from "./inline-typography"
import { microTypography } from "./micro-typography"
import { temmlMath } from "./math"
import { tableDirective, tableScroll } from "./tables"
import { captureTocHeadings } from "./toc-headings"
import { unhandledDirectives } from "./unhandled-directives"

export const mdastPlugins = [
  frontmatterInline,
  microTypography,
  inlineSvg,
  calloutDirective,
  contentDirectives,
  inlineExpressiveCode,
  loosenRichListItems,
  temmlMath,
  tableDirective,
  unhandledDirectives,
]

export const hastPlugins = [
  normalizeTabPanels,
  externalLinks,
  linkFavicons,
  parentheticalTypography,
  inlineAcronyms,
  blockExpressiveCode,
  normalizeListItemFlow,
  headingAnchors,
  captureTocHeadings,
  tableScroll,
]
