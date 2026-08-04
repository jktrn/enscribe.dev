<script lang="ts">
  import { fontById } from "./lib/fonts"
  import { matches, store } from "./lib/store.svelte"
  import AsymmetryDialog from "./ui/AsymmetryDialog.svelte"
  import BenchmarkDialog from "./ui/BenchmarkDialog.svelte"
  import Canvas from "./ui/Canvas.svelte"
  import Dialog from "./ui/Dialog.svelte"
  import MetricsRail from "./ui/MetricsRail.svelte"
  import Sidebar from "./ui/Sidebar.svelte"
  import SweepDialog from "./ui/SweepDialog.svelte"
  import Topbar from "./ui/Topbar.svelte"

  const controls = $derived(store.state)

  // The sidebar folds into a drawer first; the rail holds on to 900px.
  const sidebarDrawn = matches("(max-width: 1400px)")
  const railDrawn = matches("(max-width: 900px)")

  let asymmetries = $state(false)
  let sweep = $state(false)
  let benchmark = $state(false)
  let sidebarDrawer = $state(false)
  let railDrawer = $state(false)

  // Sweep and benchmark drive the same engine singletons, so only one may run.
  const openSweep = () => {
    benchmark = false
    sweep = true
  }
  const openBenchmark = () => {
    sweep = false
    benchmark = true
  }

  // Everything the stylesheet needs to know about the current controls.
  $effect(() => {
    const root = document.documentElement
    root.dataset.theme = controls.theme
    root.style.setProperty("--measure", `${controls.measure}px`)
    root.style.setProperty("--size", `${controls.size}px`)
    root.style.setProperty("--indent", `${controls.indent}em`)
    root.style.setProperty("--family", fontById(controls.font).stack)
    document.body.classList.toggle("rulers", controls.rulers)
  })

  // A viewport change moves the measure edges, so the geometry has to be
  // read again even though no control moved.
  let resizeTimer = 0
  const onresize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => store.invalidate(), 150)
  }
</script>

<svelte:window {onresize} />

<div class="shell">
  <Topbar
    onsidebar={() => (sidebarDrawer = true)}
    onrail={() => (railDrawer = true)}
  />

  <div class="body">
    {#if !sidebarDrawn.current}
      <Sidebar />
    {/if}

    <Canvas />

    {#if !railDrawn.current}
      <MetricsRail
        onasymmetries={() => (asymmetries = true)}
        onsweep={openSweep}
        onbenchmark={openBenchmark}
      />
    {/if}
  </div>
</div>

{#if sidebarDrawn.current}
  <Dialog bind:open={sidebarDrawer} title="Controls" width="340px">
    <Sidebar />
  </Dialog>
{/if}

{#if railDrawn.current}
  <Dialog bind:open={railDrawer} title="Metrics" width="380px">
    <MetricsRail
      onasymmetries={() => {
        railDrawer = false
        asymmetries = true
      }}
      onsweep={() => {
        railDrawer = false
        openSweep()
      }}
      onbenchmark={() => {
        railDrawer = false
        openBenchmark()
      }}
    />
  </Dialog>
{/if}

<AsymmetryDialog bind:open={asymmetries} />
<SweepDialog bind:open={sweep} />
<BenchmarkDialog bind:open={benchmark} />
