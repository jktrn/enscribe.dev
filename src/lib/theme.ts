declare const applyTheme: (doc: Document, theme: string | null) => void

export type Scheme = "light" | "dark"

const system = matchMedia("(prefers-color-scheme: dark)")

const systemScheme = (): Scheme => (system.matches ? "dark" : "light")

export const currentScheme = (): Scheme =>
  document.documentElement.dataset.theme === "dark" ||
  document.documentElement.dataset.theme === "light"
    ? document.documentElement.dataset.theme
    : systemScheme()

export const toggleScheme = () => {
  const target = currentScheme() === "dark" ? "light" : "dark"
  const override = target === systemScheme() ? null : target
  applyTheme(document, override)
  try {
    if (override) localStorage.theme = override
    else localStorage.removeItem("theme")
  } catch {}
}

export const syncSchemeAcrossTabs = () => {
  window.addEventListener("storage", (event) => {
    if (event.key === "theme") applyTheme(document, event.newValue)
  })
}

export const onSchemeChange = (listener: () => void) => {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributeFilter: ["data-theme"],
  })
  system.addEventListener("change", listener)
  return () => {
    observer.disconnect()
    system.removeEventListener("change", listener)
  }
}
