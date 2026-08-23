const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

export const ordinalSuffix = (day: number) => {
  const lastTwoDigits = day % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return "th"

  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

export const formatDateParts = (date: Date) => {
  const parts = Object.fromEntries(
    dateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  )
  const day = Number(parts.day)

  return {
    month: parts.month,
    day,
    suffix: ordinalSuffix(day),
    year: parts.year,
  }
}

export function formatDate(date: Date): string {
  const { month, day, suffix, year } = formatDateParts(date)
  return `${month} ${day}${suffix}, ${year}`
}

export const isSubpost = (id: string) => id.includes("/")

export const subpostSlug = (id: string) => id.split("/")[1]

export const normalizePath = (pathname: string) => {
  try {
    return decodeURIComponent(pathname).replace(/\/+$/, "")
  } catch {
    return pathname.replace(/\/+$/, "")
  }
}

export const hashId = (hash: string) => decodeURIComponent(hash.slice(1))

export const queryId = <T extends Element = HTMLElement>(
  root: ParentNode,
  id: string,
) => root.querySelector<T>(`[id="${CSS.escape(id)}"]`)

export const pixels = (value: string) => Number.parseFloat(value) || 0
