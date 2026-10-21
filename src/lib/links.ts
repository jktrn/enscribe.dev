import {
  assertLinkIconAsset,
  linkIconForHost,
  normalizeHost,
} from "@/lib/link-icons"

const HANDLE_HOSTS = new Set(["twitter.com", "x.com"])

export type LinkDescription = {
  href: string
  label: string
  icon: string
  external: boolean
}

const pathLabel = (pathname: string) => pathname.replace(/(.)\/$/u, "$1")

export function describeLink(href: string, site?: URL): LinkDescription {
  const url = new URL(href, site)
  const host = normalizeHost(url.hostname)
  const icon = assertLinkIconAsset(linkIconForHost(host))

  if (site && url.origin === site.origin) {
    return {
      href: `${url.pathname}${url.search}${url.hash}`,
      label: pathLabel(url.pathname),
      icon,
      external: false,
    }
  }

  const segments = url.pathname.split("/").filter(Boolean)
  const handle =
    HANDLE_HOSTS.has(host) && segments.length === 1 ? segments[0] : null
  return {
    href: url.href,
    label: handle ? `@${handle}` : host,
    icon,
    external: true,
  }
}
