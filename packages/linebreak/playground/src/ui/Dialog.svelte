<script lang="ts">
  import * as dialog from "@zag-js/dialog"
  import { normalizeProps, portal, useMachine } from "@zag-js/svelte"
  import type { Snippet } from "svelte"

  let {
    open = $bindable(),
    title,
    width = "640px",
    children,
    actions,
    footer,
  }: {
    open: boolean
    title: string
    width?: string
    children: Snippet
    actions?: Snippet
    footer?: Snippet
  } = $props()

  const id = $props.id()

  const service = useMachine(dialog.machine, () => ({
    id,
    open,
    onOpenChange: (details: dialog.OpenChangeDetails) => {
      open = details.open
    },
  }))

  const api = $derived(dialog.connect(service, normalizeProps))
</script>

{#if api.open}
  <div use:portal {...api.getBackdropProps()} class="backdrop"></div>
  <div use:portal {...api.getPositionerProps()} class="positioner">
    <div
      {...api.getContentProps()}
      class="dialog"
      style="--dialog-width: {width}"
    >
      <header>
        <h2 {...api.getTitleProps()}>{title}</h2>
        <div class="spacer"></div>
        {@render actions?.()}
        <button
          {...api.getCloseTriggerProps()}
          class="btn"
          data-variant="quiet"
        >
          Close
        </button>
      </header>
      <div class="scroll">
        {@render children()}
      </div>
      {#if footer}
        <footer>{@render footer()}</footer>
      {/if}
    </div>
  </div>
{/if}
