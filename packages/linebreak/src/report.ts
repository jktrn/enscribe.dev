import { LINE_SELECTOR, TYPESET_SELECTOR } from "./dom/render"
import { isExpected, type Outcome } from "./types"

export { ATTRIBUTES } from "./attributes"

export { LINE_SELECTOR, TYPESET_SELECTOR }

type ReporterOptions = {
  level?: "failed" | "declined" | "all"
  prefix?: string
}

const reportOutcome = (
  outcome: Outcome,
  level: ReporterOptions["level"],
  prefix: string,
) => {
  if (level !== "all" && isExpected(outcome)) return
  if (level === "failed" && outcome.status !== "failed") return
  if (outcome.status === "typeset") {
    console.info(`${prefix}: typeset ${outcome.lines} lines`, outcome.element)
    return
  }
  const log = outcome.status === "failed" ? console.warn : console.debug
  log(`${prefix}: ${outcome.status} (${outcome.reason})`, outcome.element)
}

export const consoleReporter = (options: ReporterOptions = {}) => {
  const level = options.level
  const prefix = options.prefix ?? "linebreak"
  return (outcome: Outcome) => reportOutcome(outcome, level, prefix)
}
