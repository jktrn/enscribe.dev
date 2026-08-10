<script lang="ts">
  import {
    configsFor,
    FLAGS,
    leaderOf,
    planFor,
    reportFor,
    runBenchmark,
    type Run,
    type Scale,
    type Tally,
  } from "../lib/benchmark"
  import { results } from "../lib/results.svelte"
  import { yieldToUi } from "../lib/schedule"
  import { SAMPLES } from "../lib/samples"
  import { ENGINES } from "../lib/state"
  import { store } from "../lib/store.svelte"
  import type { Slot } from "../lib/typeset"
  import Dialog from "./Dialog.svelte"

  let { open = $bindable() }: { open: boolean } = $props()

  const SCALES: { value: Scale; label: string }[] = [
    { value: "quick", label: "quick" },
    { value: "standard", label: "standard" },
    { value: "thorough", label: "thorough" },
  ]

  let scale = $state<Scale>("quick")
  let runs = $state<Run[]>([])
  let done = $state(0)
  let running = $state(false)
  let startedAt = $state(0)
  let elapsed = $state(0)

  let host = $state<HTMLElement>()
  let typesetEls = $state<HTMLElement[]>([])
  let nativeEls = $state<HTMLElement[]>([])

  let controller: AbortController | null = null
  let inflight: Promise<unknown> | null = null
  let token = 0

  const sampleIds = SAMPLES.map((sample) => sample.id)
  const configs = $derived(
    configsFor(planFor(scale, store.state, sampleIds), store.state),
  )
  const report = $derived(reportFor(runs))
  const leader = $derived(leaderOf(report.overall))
  const leadCount = $derived(
    leader === null ? 0 : (report.overall.wins[ENGINES.indexOf(leader)] ?? 0),
  )

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
    const planned = configs
    const snapshot = { ...store.state }

    while (results.busy) await yieldToUi()
    if (mine !== token) return

    runs = []
    done = 0
    running = true
    startedAt = performance.now()
    elapsed = 0

    const surface: Slot[] = ENGINES.map((engine, index) => ({
      engine,
      typeset: typesetEls[index] as HTMLElement,
      native: nativeEls[index] ?? null,
    }))

    controller = new AbortController()
    const run = runBenchmark({
      configs: planned,
      state: snapshot,
      host,
      surface,
      signal: controller.signal,
      onRun: (result, completed) => {
        if (mine !== token) return
        runs = [...runs, result]
        done = completed
        elapsed = performance.now() - startedAt
      },
    })
    inflight = run
    await run
    if (mine !== token) return

    inflight = null
    running = false
    controller = null
    store.invalidate()
  }

  $effect(() => {
    if (!open) stop()
  })

  const percent = $derived(
    configs.length === 0 ? 0 : (done / configs.length) * 100,
  )

  const widest = (tally: Tally) => Math.max(1, ...tally.wins)

  const seconds = (ms: number) =>
    ms < 60_000
      ? `${Math.round(ms / 1000)}s`
      : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

  const remaining = $derived.by(() => {
    if (!running || done === 0) return null
    return seconds((elapsed / done) * (configs.length - done))
  })
</script>

{#snippet bars(tally: Tally)}
  <ol class="tally">
    {#each ENGINES as engine, index (engine)}
      <li style="--engine: var(--{engine})">
        <span class="swatch"></span>
        <span class="who">{engine}</span>
        <span class="bar">
          <i
            style="width: {((tally.wins[index] ?? 0) / widest(tally)) * 100}%"
          > </i>
        </span>
        <span class="count">{tally.wins[index] ?? 0}</span>
      </li>
    {/each}
  </ol>
{/snippet}

<Dialog bind:open title="Benchmark" width="min(1000px, 96vw)">
  {#snippet actions()}
    <select
      class="pick"
      aria-label="grid size"
      value={scale}
      onchange={(event) => (scale = event.currentTarget.value as Scale)}
    >
      {#each SCALES as option (option.value)}
        <option value={option.value}>
          {option.label}
          ·
          {configsFor(
            planFor(option.value, store.state, sampleIds),
            store.state,
          ).length}
          runs
        </option>
      {/each}
    </select>
  {/snippet}

  {#if runs.length === 0}
    <div class="brief">
      <p>
        Typesets every combination of the four feature flags across a grid of
        measures, font sizes and samples, then counts which engine takes each
        metric. Ties count for nobody.
      </p>
      <dl class="grid-summary">
        <div>
          <dt>runs</dt>
          <dd>{configs.length}</dd>
        </div>
        <div>
          <dt>contests</dt>
          <dd>{(configs.length * report.byMetric.length).toLocaleString()}</dd>
        </div>
        <div>
          <dt>flags</dt>
          <dd>{FLAGS.join(", ")}</dd>
        </div>
      </dl>
      <p class="note">
        Every run is a full three-engine typeset read back from live layout.
        Progress and a time estimate appear once it starts, and it can be
        cancelled at any point.
      </p>
    </div>
  {:else}
    <section class="headline">
      <p class="lede">
        {#if leader === null}
          No engine leads across {report.runs} runs.
        {:else}
          <span class="lead">{leader}</span>
          takes {leadCount.toLocaleString()} of
          {report.overall.total.toLocaleString()}
          contests over
          {report.runs}
          runs.
        {/if}
      </p>
      {@render bars(report.overall)}
    </section>

    <div class="cuts">
      <section>
        <h3 class="section-title">By metric</h3>
        <div class="cut-rows">
          {#each report.byMetric as entry (entry.key)}
            <div class="cut-row">
              <span class="cut-label">{entry.label}</span>
              <span class="stack-bar">
                {#each ENGINES as engine, index (engine)}
                  <i
                    style="--engine: var(--{engine}); flex: {entry.tally.wins[
                      index
                    ] ?? 0}"
                  ></i>
                {/each}
              </span>
              <span class="cut-lead">{leaderOf(entry.tally) ?? "tie"}</span>
            </div>
          {/each}
        </div>
      </section>

      <section>
        <h3 class="section-title">By feature</h3>
        <div class="cut-rows">
          {#each report.byFlag as entry (entry.flag)}
            <div class="cut-row" data-shape="pair">
              <span class="cut-label">{entry.flag}</span>
              <span class="cut-pair">
                on <span class="lead">{leaderOf(entry.on) ?? "tie"}</span>
              </span>
              <span class="cut-pair">
                off <span class="lead">{leaderOf(entry.off) ?? "tie"}</span>
              </span>
            </div>
          {/each}
        </div>

        <h3 class="section-title" style="margin-top: 16px">By measure</h3>
        <div class="cut-rows">
          {#each report.byMeasure as entry (entry.measure)}
            <div class="cut-row">
              <span class="cut-label">{entry.measure}px</span>
              <span class="stack-bar">
                {#each ENGINES as engine, index (engine)}
                  <i
                    style="--engine: var(--{engine}); flex: {entry.tally.wins[
                      index
                    ] ?? 0}"
                  ></i>
                {/each}
              </span>
              <span class="cut-lead">{leaderOf(entry.tally) ?? "tie"}</span>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  {#snippet footer()}
    <div class="progress"><i style="width: {percent}%"></i></div>
    <span class="sweep-status">
      {done}
      / {configs.length} runs
      {#if remaining !== null}
        · {remaining} left
      {/if}
      {#if !running && done > 0}
        · took {seconds(elapsed)}
      {/if}
    </span>
    {#if running}
      <button class="btn" onclick={stop}>Cancel</button>
    {:else}
      <button class="btn" data-variant="primary" onclick={() => void start()}>
        {runs.length === 0 ? "Run benchmark" : "Run again"}
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
