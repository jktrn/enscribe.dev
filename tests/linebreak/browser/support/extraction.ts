import { extractBlock } from "@linebreak/dom/extract"

// Happy DOM omits these CSS Text 4 computed values and inline UA defaults.
export const read = (element: Element) => {
  const style = getComputedStyle(element)
  return new Proxy(style, {
    get(target, property) {
      if (property === "display")
        return element.getAttribute("data-display") || style.display || "inline"
      if (property === "whiteSpaceCollapse")
        return element.closest("[data-preserve]") ? "preserve" : "collapse"
      if (property === "textWrapMode")
        return element
          .closest("[data-nowrap], [data-wrap]")
          ?.hasAttribute("data-nowrap")
          ? "nowrap"
          : "wrap"
      return Reflect.get(target, property)
    },
  })
}

export const fixture = (html: string) => {
  const p = document.createElement("p")
  p.innerHTML = html
  document.body.append(p)
  return p
}

export const extract = (html: string) => {
  const result = extractBlock(fixture(html), read)
  if (!result.ok) throw new Error(result.reason)
  return result.block
}
