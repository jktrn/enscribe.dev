<script lang="ts">
  import { normalizeProps, useMachine } from "@zag-js/svelte"
  import * as toggleGroup from "@zag-js/toggle-group"

  let {
    value,
    options,
    label,
    onchange,
  }: {
    value: string
    options: readonly { value: string; label: string }[]
    label: string
    onchange: (value: string) => void
  } = $props()

  const id = $props.id()

  const service = useMachine(toggleGroup.machine, () => ({
    id,
    value: [value],
    onValueChange: (details: toggleGroup.ValueChangeDetails) => {
      const next = details.value[0]
      if (next !== undefined) onchange(next)
    },
  }))

  const api = $derived(toggleGroup.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()} class="segmented" aria-label={label}>
  {#each options as option (option.value)}
    <button {...api.getItemProps({ value: option.value })}>
      {option.label}
    </button>
  {/each}
</div>
