import { DEFAULT_STATE, loadState, saveState, type State } from "./state"

class Store {
  state = $state<State>(loadState())

  /**
   * Bumped when something outside the state object invalidates the canvas —
   * a viewport resize, or a sweep that tore down the shared engine
   * singletons behind the live columns.
   */
  revision = $state(0)

  patch(change: Partial<State>) {
    this.state = { ...this.state, ...change }
  }

  reset() {
    this.state = { ...DEFAULT_STATE }
  }

  invalidate() {
    this.revision += 1
  }

  persist() {
    saveState(this.state)
  }
}

export const store = new Store()

/** Tracks a media query as a rune, for layouts that switch to drawers. */
export const matches = (query: string) => {
  const list = window.matchMedia(query)
  let value = $state(list.matches)
  const onChange = (event: MediaQueryListEvent) => {
    value = event.matches
  }
  list.addEventListener("change", onChange)
  return {
    get current() {
      return value
    },
  }
}
