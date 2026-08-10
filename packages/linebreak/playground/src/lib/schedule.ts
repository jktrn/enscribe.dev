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
