<script lang="ts">
  import type { Metric } from "../lib/scoring"
  import type { SweepPoint, SweepSpec } from "../lib/sweep"
  import { ENGINES } from "../lib/state"

  let {
    metric,
    points,
    spec,
    cursor,
    marker,
    oncursor,
    oncommit,
  }: {
    metric: Metric
    points: readonly SweepPoint[]
    spec: SweepSpec
    cursor: number | null
    marker: number
    oncursor: (index: number | null) => void
    oncommit: ((value: number) => void) | null
  } = $props()

  const W = 280
  const H = 136
  const PAD = { top: 8, right: 8, bottom: 15, left: 34 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const series = $derived(
    ENGINES.map((engine, index) => ({
      engine,
      values: points.map((point) => metric.read(point.columns[index])),
    })),
  )

  const domain = $derived.by(() => {
    const all = series.flatMap((entry) => entry.values)
    if (all.length === 0) return { lo: 0, hi: 1 }
    const lo = Math.min(...all)
    const hi = Math.max(...all)
    if (lo === hi) return { lo: Math.min(0, lo - 1), hi: hi + 1 }
    const pad = (hi - lo) * 0.08
    return { lo: lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi: hi + pad }
  })

  const xOf = (value: number) =>
    PAD.left +
    ((value - spec.min) / Math.max(1e-9, spec.max - spec.min)) * plotW

  const yOf = (value: number) =>
    PAD.top +
    plotH -
    ((value - domain.lo) / Math.max(1e-9, domain.hi - domain.lo)) * plotH

  const pathOf = (values: readonly number[]) =>
    values
      .map((value, index) => {
        const point = points[index]
        if (point === undefined) return ""
        return `${index === 0 ? "M" : "L"}${xOf(point.value).toFixed(1)} ${yOf(value).toFixed(1)}`
      })
      .join(" ")

  const indexAt = (event: PointerEvent) => {
    if (points.length === 0) return null
    const box = (
      event.currentTarget as SVGGraphicsElement
    ).getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * W
    let nearest = 0
    let best = Infinity
    for (const [index, point] of points.entries()) {
      const distance = Math.abs(xOf(point.value) - x)
      if (distance < best) {
        best = distance
        nearest = index
      }
    }
    return nearest
  }

  const at = $derived(cursor === null ? null : points[cursor])

  let dragging = $state(false)

  const commit = (index: number | null) => {
    if (index === null || oncommit === null) return
    const point = points[index]
    if (point !== undefined) oncommit(point.value)
  }
</script>

<figure class="chart">
  <figcaption>
    <span class="chart-title">{metric.label}</span>
    <span class="axis-hint">
      {#if !metric.ranked}
        not scored
      {:else if metric.direction === "lower"}
        lower wins
      {:else}
        nearer 100% wins
      {/if}
    </span>
  </figcaption>

  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="{metric.label} against {spec.label}"
    onpointermove={(event) => {
      const index = indexAt(event)
      oncursor(index)
      if (dragging) commit(index)
    }}
    onpointerleave={() => {
      oncursor(null)
      dragging = false
    }}
    onpointerdown={(event) => {
      if (oncommit === null) return
      dragging = true
      ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
      commit(indexAt(event))
    }}
    onpointerup={(event) => {
      dragging = false
      ;(event.currentTarget as SVGSVGElement).releasePointerCapture(
        event.pointerId,
      )
    }}
  >
    <line
      class="grid-line"
      x1={PAD.left}
      y1={PAD.top}
      x2={W - PAD.right}
      y2={PAD.top}
    />
    <line
      class="grid-line"
      x1={PAD.left}
      y1={PAD.top + plotH}
      x2={W - PAD.right}
      y2={PAD.top + plotH}
    />

    <text class="axis-text" x={PAD.left - 4} y={PAD.top + 3} text-anchor="end">
      {metric.format(domain.hi)}
    </text>
    <text
      class="axis-text"
      x={PAD.left - 4}
      y={PAD.top + plotH + 3}
      text-anchor="end"
    >
      {metric.format(domain.lo)}
    </text>
    <text class="axis-text" x={PAD.left} y={H - 3}>
      {spec.min}{spec.unit}
    </text>
    <text class="axis-text" x={W - PAD.right} y={H - 3} text-anchor="end">
      {spec.max}{spec.unit}
    </text>

    {#if points.length > 0}
      <line
        class="marker"
        x1={xOf(marker)}
        y1={PAD.top}
        x2={xOf(marker)}
        y2={PAD.top + plotH}
      />
    {/if}

    {#each series as entry (entry.engine)}
      <path
        class="series"
        d={pathOf(entry.values)}
        vector-effect="non-scaling-stroke"
        style="stroke: var(--{entry.engine})"
      />
    {/each}

    {#if at !== undefined && at !== null}
      <line
        class="cursor"
        x1={xOf(at.value)}
        y1={PAD.top}
        x2={xOf(at.value)}
        y2={PAD.top + plotH}
      />
      {#each series as entry, index (entry.engine)}
        {@const value = entry.values[cursor ?? 0]}
        {#if value !== undefined}
          <circle
            class="dot"
            cx={xOf(at.value)}
            cy={yOf(value)}
            r="4"
            style="fill: var(--{ENGINES[index]})"
          />
        {/if}
      {/each}
    {/if}

    <rect class="hit" x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
  </svg>

  <div class="readout">
    {#each series as entry, index (entry.engine)}
      {@const value = entry.values[cursor ?? entry.values.length - 1]}
      <span style="--engine: var(--{entry.engine})">
        <i></i>
        <span class="sr-only">{ENGINES[index]}</span>
        {value === undefined ? "—" : metric.format(value)}
      </span>
    {/each}
  </div>
</figure>
