<script lang="ts">
  import { asymmetriesFor } from "../lib/asymmetries"
  import { results } from "../lib/results.svelte"
  import { store } from "../lib/store.svelte"
  import Dialog from "./Dialog.svelte"

  let { open = $bindable() }: { open: boolean } = $props()

  const notes = $derived(
    asymmetriesFor(results.effective ?? store.state, results.widthResponse),
  )
</script>

<Dialog bind:open title="Asymmetries" width="760px">
  <p class="note" style="margin-bottom: 14px; max-width: 68ch">
    Where the two engines are not doing the same thing, on purpose or by
    omission. These track the current controls.
  </p>
  <dl class="notes">
    {#each notes as note (note.title)}
      <div>
        <dt>{note.title}</dt>
        <dd>
          {#each note.body as segment, index (index)}
            {#if segment.code}
              <code>{segment.text}</code>
            {:else}
              {segment.text}
            {/if}
          {/each}
        </dd>
      </div>
    {/each}
  </dl>
</Dialog>
