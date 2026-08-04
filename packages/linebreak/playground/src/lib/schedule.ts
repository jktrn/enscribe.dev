/**
 * Hands control back to the event loop between units of work, so progress can
 * paint and a cancellation can land.
 *
 * `requestAnimationFrame` is the right vehicle while the document is visible —
 * it lands exactly once per paint. But a hidden tab never fires it, which would
 * stall a sweep or benchmark indefinitely the moment the user switches away.
 * `setTimeout` keeps firing there but is clamped to about a second in
 * background tabs, which would turn a 48-run benchmark into a 48-second one. A
 * `MessageChannel` hop is an unclamped macrotask, so it covers the hidden case
 * without that penalty.
 */
export const yieldToUi = () =>
  new Promise<void>((resolve) => {
    if (!document.hidden) {
      requestAnimationFrame(() => resolve())
      return
    }
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })
