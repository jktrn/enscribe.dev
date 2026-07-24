export const cleanCopiedLinebreaks = (event: ClipboardEvent) => {
  const selection = getSelection()
  if (!selection || selection.rangeCount !== 1 || !event.clipboardData) return

  const holder = document.createElement("div")
  holder.appendChild(selection.getRangeAt(0).cloneContents())
  const generated = holder.querySelectorAll<HTMLElement>(
    ".kp-line, br.kp-break, .kp-hyphen",
  )
  if (generated.length === 0) return

  for (const element of generated) {
    if (element.classList.contains("kp-break")) {
      element.replaceWith(
        document.createTextNode(element.dataset.break === "space" ? " " : ""),
      )
    } else if (element.classList.contains("kp-hyphen")) {
      element.remove()
    } else {
      element.replaceWith(...element.childNodes)
    }
  }
  for (const element of holder.querySelectorAll<HTMLElement>("*")) {
    for (const key of Object.keys(element.dataset)) {
      if (key.startsWith("kp")) delete element.dataset[key]
    }
  }

  event.clipboardData.setData("text/plain", holder.textContent ?? "")
  event.clipboardData.setData("text/html", holder.innerHTML)
  event.preventDefault()
}
