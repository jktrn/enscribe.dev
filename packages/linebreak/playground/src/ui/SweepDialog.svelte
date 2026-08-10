<script lang="ts">
  import { results } from "../lib/results.svelte"
  import { yieldToUi } from "../lib/schedule"
  import { CHARTED } from "../lib/scoring"
  import { ENGINES, type SweepAxis } from "../lib/state"
  import { store } from "../lib/store.svelte"
  import {
    cached,
    cacheKey,
    defaultStep,
    runSweep,
    stepsFor,
    SWEEPS,
    type SweepPoint,
  } from "../lib/sweep"
  import type { Slot } from "../lib/typeset"
  import Dialog from "./Dialog.svelte"
  import Segmented from "./Segmented.svelte"
  import SweepChart from "./SweepChart.svelte"

  let { open = $bindable() }: { open: boolean } = $props()

  const axis = $derived(store.state.sweepAxis)
  const spec = $derived(SWEEPS[axis])
  const marker = $derived(
    axis === "measure" ? store.state.measure : store.state.size,
  )

  let step = $state(defaultStep("measure"))
  $effect(() => {
    step = defaultStep(axis)
  })

  let points = $state<SweepPoint[]>([])
  let done = $state(0)
  let total = $state(0)
  let running = $state(false)
  let cursor = $state<number | null>(null)

  let host = $state<HTMLElement>()
  let typesetEls = $state<HTMLElement[]>([])
  let nativeEls = $state<HTMLElement[]>([])

  let controller: AbortController | null = null
  let inflight: Promise<unknown> | null = null
  let token = 0

  const stop = () => {
    controller?.abort()
    controller = null
    running = false
  }

  const start = async () => {
    if (host === undefined || typesetEls.length < ENGINES.length) return

    stop()
    await inflight

    const mine = ++token
    const at = axis
    const by = step
    const snapshot = { ...store.state }

    const hit = cached(at, by, snapshot)
    if (hit !== undefined) {
      points = hit
      done = hit.length
      total = hit.length
      return
    }

    while (results.busy) await yieldToUi()
    if (mine !== token) return
    results.locked = true

    points = []
    done = 0
    total = stepsFor(at, by).length
    running = true

    const surface: Slot[] = ENGINES.map((engine, index) => ({
      engine,
      typeset: typesetEls[index] as HTMLElement,
      native: nativeEls[index] ?? null,
    }))

    controller = new AbortController()
    const run = runSweep({
      axis: at,
      step: by,
      state: snapshot,
      host,
      surface,
      signal: controller.signal,
      onPoint: (point, completed, count) => {
        if (mine !== token) return
        points = [...points, point]
        done = completed
        total = count
      },
    })
    inflight = run
    try {
      await run
    } finally {
      if (mine === token) {
        inflight = null
        running = false
        controller = null
        results.locked = false
      }
    }
    if (mine !== token) return

    store.invalidate()
  }

  $effect(() => {
    if (!open) {
      stop()
      return
    }
    void cacheKey(axis, step, store.state)
    void start()
  })

  const commit = (value: number) => {
    store.patch(axis === "measure" ? { measure: value } : { size: value })
  }

  const percent = $derived(total === 0 ? 0 : (done / total) * 100)
</script>

<Dialog bind:open title="Sweep the range" width="min(1120px, 96vw)">
  {#snippet actions()}
    <Segmented
      label="swept axis"
      value={axis}
      options={[
        { value: "measure", label: "measure" },
        { value: "size", label: "font size" },
      ]}
      onchange={(next) => store.patch({ sweepAxis: next as SweepAxis })}
    />
    <select
      class="pick"
      aria-label="resolution"
      value={step}
      onchange={(event) => (step = Number(event.currentTarget.value))}
    >
      {#each spec.steps as option (option)}
        <option value={option}>
          {option}{spec.unit}
          · {stepsFor(axis, option).length} points
        </option>
      {/each}
    </select>
  {/snippet}

  <div class="legend">
    {#each ENGINES as engine (engine)}
      <span style="--engine: var(--{engine})"><i></i>{engine}</span>
    {/each}
  </div>

  {#if points.length === 0}
    <p class="empty">
      {running ? "Typesetting the first point…" : "No points yet."}
    </p>
  {:else}
    <div class="charts">
      {#each CHARTED as metric (metric.key)}
        <SweepChart
          {metric}
          {points}
          {spec}
          {cursor}
          {marker}
          oncursor={(index) => (cursor = index)}
          oncommit={running ? null : commit}
        />
      {/each}
    </div>

    <details style="margin-top: 16px">
      <summary class="section-title" style="cursor: pointer">
        Table of swept values
      </summary>
      <div style="overflow-x: auto; margin-top: 10px">
        <table class="sweep-table">
          <thead>
            <tr>
              <th scope="col">{spec.label}</th>
              {#each CHARTED as metric (metric.key)}
                {#each ENGINES as engine (engine)}
                  <th scope="col">{metric.label} · {engine}</th>
                {/each}
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each points as point (point.value)}
              <tr>
                <th scope="row">{point.value}{spec.unit}</th>
                {#each CHARTED as metric (metric.key)}
                  {#each point.columns as column, index (ENGINES[index])}
                    <td>{metric.format(metric.read(column))}</td>
                  {/each}
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}

  {#snippet footer()}
    <div class="progress">
      <i style="width: {percent}%"></i>
    </div>
    <span class="sweep-status">
      {done}
      / {total} points
      {#if !running && points.length > 0}
        · drag a chart to set {spec.label}
      {/if}
    </span>
    {#if running}
      <button class="btn" onclick={stop}>Cancel</button>
    {:else}
      <button class="btn" data-variant="primary" onclick={() => void start()}>
        Run again
      </button>
    {/if}
  {/snippet}
</Dialog>

<div class="sweep-host" aria-hidden="true" bind:this={host}>
  {#each ENGINES as engine, index (engine)}
    <div class="stack">
      <div class="article" bind:this={typesetEls[index]}></div>
      {#if engine !== "browser"}
        <div class="article native" bind:this={nativeEls[index]}></div>
      {/if}
    </div>
  {/each}
</div>
