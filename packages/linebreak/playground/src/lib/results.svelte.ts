import type { Triple } from "./scoring"
import type { State } from "./state"
import type { Outcomes } from "./typeset"

class Results {
  columns = $state<Triple | null>(null)
  effective = $state<State | null>(null)
  widthResponse = $state(0)
  outcomes = $state<Outcomes>({})
  busy = $state(true)
  locked = $state(false)
}

export const results = new Results()
