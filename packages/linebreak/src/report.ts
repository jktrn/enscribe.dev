import { LINE_SELECTOR, TYPESET_SELECTOR } from "./dom/render"
import { isExpected, type Outcome } from "./types"

export { LINE_SELECTOR, TYPESET_SELECTOR }

/**
 * The HTML contract, as constants rather than a table in a README.
 *
 * Build-time pipelines that emit `atom` markup should import this instead of
 * hand-typing the string — a rename should be a type error, not a silent
 * regression in line quality.
 */
export const ATTRIBUTES = Object.freeze({
  /** Written to a typeset element. Value is the line count. */
  typeset: "data-linebreak-typeset",
  /** Written to each generated line. Value is what ended it. */
  line: "data-linebreak-line",
  /** Written to each copy of an inline wrapper split across lines. */
  fragment: "data-linebreak-fragment",
  fragmentStart: "data-linebreak-fragment-start",
  fragmentEnd: "data-linebreak-fragment-end",
  /** Read: measure this element as one indivisible inline object. */
  atom: "data-linebreak-atom",
  /** Read: a decorative child whose width counts but whose text does not. */
  decoration: "data-linebreak-decoration",
  decorationPosition: "data-linebreak-decoration-position",
  /** Read by `proseBlocks`: leave this subtree ragged. */
  skip: "data-linebreak-skip",
  /** Read by `createTypesetter`: look for paragraphs under here. */
  root: "data-linebreak-root",
})

export type ReporterOptions = {
  /**
   * `"failed"` reports only reverted writes. `"declined"` (the default) adds
   * content the engine could not model. `"all"` includes routine skips, which
   * on a long page means most paragraphs.
   */
  level?: "failed" | "declined" | "all"
  prefix?: string
}

/**
 * A ready-made `onOutcome` handler for development.
 *
 * ```ts
 * createTypesetter({ onOutcome: import.meta.env.DEV ? consoleReporter() : undefined })
 * ```
 */
export const consoleReporter = (options: ReporterOptions = {}) => {
  const level = options.level ?? "declined"
  const prefix = options.prefix ?? "linebreak"
  return (outcome: Outcome) => {
    if (level !== "all" && isExpected(outcome)) return
    if (level === "failed" && outcome.status !== "failed") return
    if (outcome.status === "typeset") {
      console.info(`${prefix}: typeset ${outcome.lines} lines`, outcome.element)
      return
    }
    const log = outcome.status === "failed" ? console.warn : console.debug
    log(`${prefix}: ${outcome.status} (${outcome.reason})`, outcome.element)
  }
}
