const HOST_STYLE =
  "position:absolute;left:-100000px;top:0;visibility:hidden;" +
  "pointer-events:none;contain:layout style paint"

export const offscreen = <T>(
  document: Document,
  use: (host: HTMLDivElement) => T,
): T | null => {
  const root = document.body ?? document.documentElement
  if (!root) return null

  const host = document.createElement("div")
  host.setAttribute("aria-hidden", "true")
  host.style.cssText = HOST_STYLE
  root.append(host)
  try {
    return use(host)
  } finally {
    host.remove()
  }
}
