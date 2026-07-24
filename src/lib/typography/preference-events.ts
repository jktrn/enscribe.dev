type PreferenceChange = CustomEvent<{ enabled: boolean }>

declare global {
  interface DocumentEventMap {
    "text-justification-change": PreferenceChange
    "reader-mode-change": PreferenceChange
  }
}

type PreferenceEventName = "text-justification-change" | "reader-mode-change"

const dispatchPreferenceChange = (
  name: PreferenceEventName,
  enabled: boolean,
) => document.dispatchEvent(new CustomEvent(name, { detail: { enabled } }))

const onPreferenceChange = (
  name: PreferenceEventName,
  listener: (enabled: boolean) => void,
  signal: AbortSignal,
) => {
  document.addEventListener(name, (event) => listener(event.detail.enabled), {
    signal,
  })
}

export const dispatchJustificationChange = (enabled: boolean) =>
  dispatchPreferenceChange("text-justification-change", enabled)

export const onJustificationChange = (
  listener: (enabled: boolean) => void,
  signal: AbortSignal,
) => onPreferenceChange("text-justification-change", listener, signal)

export const dispatchReaderModeChange = (enabled: boolean) =>
  dispatchPreferenceChange("reader-mode-change", enabled)

export const onReaderModeChange = (
  listener: (enabled: boolean) => void,
  signal: AbortSignal,
) => onPreferenceChange("reader-mode-change", listener, signal)
