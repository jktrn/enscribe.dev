import type { Triple } from "./scoring"
import type { State } from "./state"
import type { Outcomes } from "./typeset"

/**
 * What the last completed typeset pass measured. The canvas writes it; the
 * rail and the asymmetry notes read it.
 */
class Results {
  columns = $state<Triple | null>(null)
  /** State as the engines actually received it, after availability clamping. */
  effective = $state<State | null>(null)
  widthResponse = $state(0)
  outcomes = $state<Outcomes>({})
  busy = $state(true)
}

export const results = new Results()
