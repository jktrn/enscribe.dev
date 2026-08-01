import { LINE_SELECTOR, TYPESET_SELECTOR } from "./dom/render"
import { isExpected, type Outcome } from "./types"

export { ATTRIBUTES } from "./attributes"

export { LINE_SELECTOR, TYPESET_SELECTOR }

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
