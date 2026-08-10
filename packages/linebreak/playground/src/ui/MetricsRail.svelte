<script lang="ts">
  import { results } from "../lib/results.svelte"
  import { groupsFor, verdictFor } from "../lib/scoring"
  import { ENGINES } from "../lib/state"

  let {
    onasymmetries,
    onsweep,
    onbenchmark,
  }: {
    onasymmetries: () => void
    onsweep: () => void
    onbenchmark: () => void
  } = $props()

  const groups = $derived(
    results.columns === null ? [] : groupsFor(results.columns),
  )
  const verdict = $derived(verdictFor(groups))
  const best = $derived(Math.max(1, ...verdict.wins.map((win) => win.count)))
  const leadCount = $derived(
    verdict.wins.find((win) => win.engine === verdict.leader)?.count ?? 0,
  )
</script>

<aside class="rail">
  <section class="verdict">
    <p class="lede">
      {#if verdict.leader === null}
        No clear winner here
      {:else}
        <span class="lead">{verdict.leader}</span>
        takes {leadCount} of {verdict.total}
      {/if}
    </p>
    <ol>
      {#each verdict.wins as win (win.engine)}
        <li style="--engine: var(--{win.engine})">
          <span class="swatch"></span>
          <span class="who">{win.engine}</span>
          <span class="bar">
            <i style="width: {(win.count / best) * 100}%"></i>
          </span>
          <span class="count">{win.count}</span>
        </li>
      {/each}
    </ol>
  </section>

  <div class="metrics">
    <div class="head" aria-hidden="true">
      <span></span>
      {#each ENGINES as engine (engine)}
        <span class="swatch" style="--engine: var(--{engine})"></span>
      {/each}
    </div>

    {#each groups as group (group.title)}
      <h2 class="section-title">{group.title}</h2>
      {#each group.rows as row (row.metric.key)}
        <div class="row">
          <span class="label">{row.metric.label}</span>
          {#each row.formatted as text, index (ENGINES[index])}
            <span class="cell" data-rank={row.ranks[index]}>
              <span class="sr-only">{ENGINES[index]}</span>
              {text}
              {#if row.ranks[index] === "best"}
                <span class="sr-only">, best</span>
              {:else if row.ranks[index] === "worst"}
                <span class="sr-only">, worst</span>
              {/if}
            </span>
          {/each}
        </div>
      {/each}
    {/each}
  </div>

  <div class="actions">
    <button class="btn" onclick={onsweep}>Sweep a range…</button>
    <button class="btn" onclick={onbenchmark}>Run the benchmark…</button>
    <button class="btn" data-variant="quiet" onclick={onasymmetries}>
      Asymmetries
    </button>
  </div>
</aside>
