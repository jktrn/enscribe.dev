import type { CapacityCorrection } from "./prefix"
import { dyadic } from "./dyadic"

const bounded = (value: number) => Math.abs(value) <= Number.MAX_VALUE / 8
const exactLimit = dyadic(Number.MAX_VALUE / 4) as bigint

export const finiteTerms = (correction: CapacityCorrection | null) =>
  correction?.kind !== "wide" || correction.values.at(-1) !== null

/** Certify finite range pools; uncertain inputs use complete candidate checks. */
export const boundedPrefixes = (
  values: readonly number[],
  correction: CapacityCorrection | null,
) => {
  if (correction?.kind === "wide")
    return correction.values.every(
      (value) => value !== null && value >= -exactLimit && value <= exactLimit,
    )
  if (correction?.kind === "uniform")
    return bounded((values.at(-1) as number) * correction.unit)
  if (correction?.kind === "low")
    return values.every((value, index) =>
      bounded(value + (correction.values[index] as number)),
    )
  // Every correctly rounded prefix below MAX/8 has exact magnitude below
  // MAX/4. A difference of two such prefixes therefore remains finite.
  return values.every(bounded)
}
