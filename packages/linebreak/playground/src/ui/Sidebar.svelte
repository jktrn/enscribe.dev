<script lang="ts">
  import { FONTS, fontById } from "../lib/fonts"
  import { results } from "../lib/results.svelte"
  import { SAMPLES } from "../lib/samples"
  import { RANGES, type HangMode, type State } from "../lib/state"
  import { store } from "../lib/store.svelte"
  import Slider from "./Slider.svelte"

  const controls = $derived(store.state)

  /** A width axis this shallow cannot carry the expansion budget. */
  const AXIS_FLOOR = 0.001
  const expandable = $derived(results.widthResponse >= AXIS_FLOOR)

  const HANGS: { value: HangMode; label: string }[] = [
    { value: "none", label: "none" },
    { value: "line-end-only", label: "line ends" },
    {
      value: "first-line-and-line-ends",
      label: "line ends + first line start",
    },
    { value: "all-line-edges", label: "all line edges" },
  ]

  const patch = (change: Partial<State>) => store.patch(change)
</script>

<div class="sidebar">
  <section class="group">
    <h2 class="section-title">Text</h2>

    <div class="field">
      <div class="head"><label for="sample">sample</label></div>
      <select
        id="sample"
        class="pick"
        value={controls.sample}
        onchange={(event) => patch({ sample: event.currentTarget.value })}
      >
        {#each SAMPLES as sample (sample.id)}
          <option value={sample.id}>{sample.label}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <div class="head"><label for="font">typeface</label></div>
      <select
        id="font"
        class="pick"
        value={controls.font}
        onchange={(event) => patch({ font: event.currentTarget.value })}
      >
        {#each FONTS as font (font.id)}
          <option value={font.id}>{font.label} — {font.kind}</option>
        {/each}
      </select>
    </div>

    <Slider
      label="measure"
      value={controls.measure}
      min={RANGES.measure.min}
      max={RANGES.measure.max}
      step={RANGES.measure.step}
      format={(value) => `${value}px`}
      onchange={(measure) => patch({ measure })}
    />

    <Slider
      label="font size"
      value={controls.size}
      min={RANGES.size.min}
      max={RANGES.size.max}
      step={RANGES.size.step}
      format={(value) => `${value}px`}
      onchange={(size) => patch({ size })}
    />
  </section>

  <section class="group">
    <h2 class="section-title">Features</h2>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.hyphenate}
        onchange={(event) =>
          patch({ hyphenate: event.currentTarget.checked })}
      >
      hyphenation
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.protrude}
        onchange={(event) => patch({ protrude: event.currentTarget.checked })}
      >
      optical protrusion
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.expand && expandable}
        disabled={!expandable}
        onchange={(event) => patch({ expand: event.currentTarget.checked })}
      >
      font expansion
    </label>
    {#if !expandable}
      <p class="reason">
        {fontById(controls.font).label}
        has no usable wdth axis
      </p>
    {/if}

    <label class="check">
      <input
        type="checkbox"
        checked={controls.track}
        onchange={(event) => patch({ track: event.currentTarget.checked })}
      >
      tracking / letterfit
    </label>

    <Slider
      label="min. last-line width"
      value={controls.lastLineMinWidth}
      min={RANGES.lastLineMinWidth.min}
      max={RANGES.lastLineMinWidth.max}
      step={RANGES.lastLineMinWidth.step}
      format={(value) => value.toFixed(2)}
      onchange={(lastLineMinWidth) => patch({ lastLineMinWidth })}
    />

    <Slider
      label="emergency stretch"
      value={controls.emergencyStretch}
      min={RANGES.emergencyStretch.min}
      max={RANGES.emergencyStretch.max}
      step={RANGES.emergencyStretch.step}
      format={(value) => `${value} spaces`}
      onchange={(emergencyStretch) => patch({ emergencyStretch })}
    />

    <Slider
      label="text indent"
      value={controls.indent}
      min={RANGES.indent.min}
      max={RANGES.indent.max}
      step={RANGES.indent.step}
      format={(value) => `${value}em`}
      onchange={(indent) => patch({ indent })}
    />

    <div class="field">
      <div class="head">
        <label for="hang">hang punctuation</label>
        <span class="value">justif only</span>
      </div>
      <select
        id="hang"
        class="pick"
        value={controls.hang}
        disabled={!controls.protrude}
        onchange={(event) =>
          patch({ hang: event.currentTarget.value as HangMode })}
      >
        {#each HANGS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      {#if !controls.protrude}
        <p class="reason">off while protrusion is off</p>
      {/if}
    </div>
  </section>

  <section class="group">
    <h2 class="section-title">Overlays</h2>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.rulers}
        onchange={(event) => patch({ rulers: event.currentTarget.checked })}
      >
      margin rulers
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.tint}
        onchange={(event) => patch({ tint: event.currentTarget.checked })}
      >
      uneven spaces
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={controls.boxes}
        onchange={(event) => patch({ boxes: event.currentTarget.checked })}
      >
      line boxes + ratio
    </label>

    <button class="btn" onclick={() => store.reset()}>Reset controls</button>
  </section>
</div>
