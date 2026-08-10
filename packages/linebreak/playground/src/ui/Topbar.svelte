<script lang="ts">
  import { ENGINES, shareUrl, type EngineId, type State } from "../lib/state"
  import { store } from "../lib/store.svelte"
  import Segmented from "./Segmented.svelte"

  let { onsidebar, onrail }: { onsidebar: () => void; onrail: () => void } =
    $props()

  const controls = $derived(store.state)

  let copied = $state(false)
  let copyTimer = 0

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(controls))
      copied = true
      clearTimeout(copyTimer)
      copyTimer = window.setTimeout(() => {
        copied = false
      }, 1600)
    } catch {
      copied = false
    }
  }

  const reveal = (on: boolean) =>
    document.body.classList.toggle("revealing", on)
</script>

<header class="topbar">
  <h1 class="wordmark">linebreak <span>playground</span></h1>

  <button
    class="btn drawer-trigger"
    data-drawer="sidebar"
    data-variant="quiet"
    onclick={onsidebar}
  >
    Controls
  </button>

  <Segmented
    label="view"
    value={controls.view}
    options={[
      { value: "side", label: "side by side" },
      { value: "single", label: "single" },
    ]}
    onchange={(view) => store.patch({ view: view as State["view"] })}
  />

  {#if controls.view === "single"}
    <select
      class="pick"
      aria-label="engine"
      value={controls.single}
      onchange={(event) =>
        store.patch({ single: event.currentTarget.value as EngineId })}
    >
      {#each ENGINES as engine (engine)}
        <option value={engine}>{engine}</option>
      {/each}
    </select>
  {/if}

  <button
    class="btn"
    data-variant="quiet"
    onpointerdown={() => reveal(true)}
    onpointerup={() => reveal(false)}
    onpointerleave={() => reveal(false)}
    onfocusout={() => reveal(false)}
    onkeydown={(event) => {
      if (event.key === " " || event.key === "Enter") reveal(true)
    }}
    onkeyup={() => reveal(false)}
  >
    Hold to compare
  </button>

  <div class="spacer"></div>

  <button class="btn" data-variant="quiet" onclick={share}>
    {copied ? "Link copied" : "Copy link"}
  </button>

  <button
    class="btn drawer-trigger"
    data-drawer="rail"
    data-variant="quiet"
    onclick={onrail}
  >
    Metrics
  </button>

  <Segmented
    label="theme"
    value={controls.theme}
    options={[
      { value: "system", label: "auto" },
      { value: "light", label: "light" },
      { value: "dark", label: "dark" },
    ]}
    onchange={(theme) => store.patch({ theme: theme as State["theme"] })}
  />
</header>
