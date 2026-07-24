const MARQUEE_SPEED_PX_S = 28
const MARQUEE_MIN_DURATION_S = 4
const MARQUEE_FORWARD_FRACTION = 0.65

export interface MarqueeTiming {
  shiftPx: number
  durationSeconds: number
}

export const getMarqueeTiming = (overflowPx: number): MarqueeTiming | null => {
  if (!Number.isFinite(overflowPx) || overflowPx <= 1) return null

  return {
    shiftPx: overflowPx,
    durationSeconds: Math.max(
      overflowPx / MARQUEE_SPEED_PX_S / MARQUEE_FORWARD_FRACTION,
      MARQUEE_MIN_DURATION_S,
    ),
  }
}

export const createMarqueeText = (
  tag: string,
  text: string,
  prefix = "",
  suffix = "",
): HTMLElement => {
  const element = document.createElement(tag)
  if (prefix) {
    const label = document.createElement("span")
    label.textContent = `${prefix} `
    element.appendChild(label)
  }

  const marqueeWindow = document.createElement("span")
  marqueeWindow.setAttribute("data-marquee-window", "")

  const content = document.createElement("span")
  content.setAttribute("data-marquee-content", "")
  content.textContent = text
  if (suffix) {
    const dim = document.createElement("span")
    dim.setAttribute("data-marquee-dim", "")
    dim.textContent = suffix
    content.appendChild(dim)
  }

  marqueeWindow.appendChild(content)
  element.appendChild(marqueeWindow)
  return element
}

export const applyMarquee = (element: HTMLElement): boolean => {
  const marqueeWindow = element.querySelector<HTMLElement>(
    "span[data-marquee-window]",
  )
  const content = marqueeWindow?.querySelector<HTMLElement>(
    ":scope > [data-marquee-content]",
  )
  if (!marqueeWindow || !content) return false

  const timing = getMarqueeTiming(
    content.scrollWidth - marqueeWindow.clientWidth,
  )
  if (!timing) {
    if (marqueeWindow.hasAttribute("data-marquee-scroll")) {
      marqueeWindow.removeAttribute("data-marquee-scroll")
      marqueeWindow.style.removeProperty("--marquee-shift")
      marqueeWindow.style.removeProperty("--marquee-duration")
    }
    return false
  }

  const shift = `${timing.shiftPx}px`
  const duration = `${timing.durationSeconds}s`
  if (marqueeWindow.style.getPropertyValue("--marquee-shift") !== shift) {
    marqueeWindow.style.setProperty("--marquee-shift", shift)
  }
  if (marqueeWindow.style.getPropertyValue("--marquee-duration") !== duration) {
    marqueeWindow.style.setProperty("--marquee-duration", duration)
  }
  if (!marqueeWindow.hasAttribute("data-marquee-scroll")) {
    marqueeWindow.setAttribute("data-marquee-scroll", "")
  }
  return true
}
