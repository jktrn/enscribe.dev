<script lang="ts">
  import { fontById, loadFont } from "../lib/fonts"
  import { paintOverlay } from "../lib/overlays"
  import { results } from "../lib/results.svelte"
  import { ENGINES, type EngineId, type State } from "../lib/state"
  import { store } from "../lib/store.svelte"
  import {
    effectiveState,
    type Slot,
    typesetSurface,
    widthResponseOf,
  } from "../lib/typeset"

  const BADGES: Record<EngineId, string> = {
    browser: "text-align: justify",
    linebreak: "@enscribe/linebreak",
    justif: __JUSTIF_VERSION__,
  }

  const mirrored = (engine: EngineId) => engine !== "browser"

  let typesetEls = $state<HTMLElement[]>([])
  let nativeEls = $state<HTMLElement[]>([])
  let overlayEls = $state<HTMLElement[]>([])

  const controls = $derived(store.state)

  let generation = 0

  const surfaceOf = (): Slot[] =>
    ENGINES.map((engine, index) => ({
      engine,
      typeset: typesetEls[index] as HTMLElement,
      native: nativeEls[index] ?? null,
    }))

  const render = async (at: State) => {
    if (typesetEls.length < ENGINES.length) {
      results.busy = false
      return
    }
    const round = ++generation

    await loadFont(fontById(at.font), at.size)
    if (round !== generation) return

    const effective = effectiveState(at)
    const { outcomes, columns } = await typesetSurface(surfaceOf(), effective)
    if (round !== generation) return

    results.columns = columns
    results.effective = effective
    results.widthResponse = widthResponseOf(at)
    results.outcomes = outcomes
    results.busy = false

    for (const [index] of ENGINES.entries()) {
      const overlay = overlayEls[index]
      const column = columns[index]
      if (overlay !== undefined && column !== undefined) {
        paintOverlay(overlay, column, at)
      }
    }

    store.persist()
  }

  $effect(() => {
    const at = store.state
    void store.revision
    results.busy = true
    if (results.locked) return
    const timer = setTimeout(() => void render(at), 60)
    return () => clearTimeout(timer)
  })

  const reveal = (on: boolean) =>
    document.body.classList.toggle("revealing", on)
</script>

<svelte:window
  onpointerup={() => reveal(false)}
  onpointercancel={() => reveal(false)}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="canvas" onpointerdown={() => reveal(true)}>
  <div class="columns" data-view={controls.view}>
    {#each ENGINES as engine, index (engine)}
      <section
        class="column"
        class:solo={engine === controls.single}
        data-engine={engine}
        style="--engine: var(--{engine})"
      >
        <h2 class="column-head">
          <span class="swatch"></span>
          <span class="section-title">{engine}</span>
          <span class="badge">{BADGES[engine]}</span>
        </h2>

        <div class="stack">
          <div
            class="article"
            data-role="typeset"
            bind:this={typesetEls[index]}
          ></div>
          {#if mirrored(engine)}
            <div
              class="article native"
              aria-hidden="true"
              bind:this={nativeEls[index]}
            ></div>
          {/if}
          <div class="overlay" bind:this={overlayEls[index]}></div>
        </div>

        {#if (results.outcomes[engine] ?? []).length > 0}
          <div class="outcomes">
            {#each results.outcomes[engine] ?? [] as outcome (outcome.index)}
              <div class="outcome">
                <span class="lead">¶{outcome.index + 1} {outcome.status}</span>
                {outcome.reason}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>
