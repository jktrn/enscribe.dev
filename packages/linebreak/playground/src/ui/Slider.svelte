<script lang="ts">
  import * as slider from "@zag-js/slider"
  import { normalizeProps, useMachine } from "@zag-js/svelte"

  let {
    value,
    min,
    max,
    step,
    label,
    format,
    onchange,
  }: {
    value: number
    min: number
    max: number
    step: number
    label: string
    format: (value: number) => string
    onchange: (value: number) => void
  } = $props()

  const id = $props.id()

  const service = useMachine(slider.machine, () => ({
    id,
    min,
    max,
    step,
    value: [value],
    onValueChange: (details: slider.ValueChangeDetails) => {
      const next = details.value[0]
      if (next !== undefined) onchange(next)
    },
  }))

  const api = $derived(slider.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()} class="field">
  <div class="head">
    <label {...api.getLabelProps()}>{label}</label>
    <output {...api.getValueTextProps()} class="value">{format(value)}</output>
  </div>
  <div {...api.getControlProps()} class="slider">
    <div {...api.getTrackProps()} class="track">
      <div {...api.getRangeProps()} class="range"></div>
    </div>
    <div {...api.getThumbProps({ index: 0 })} class="thumb">
      <input {...api.getHiddenInputProps({ index: 0 })}>
    </div>
  </div>
</div>
