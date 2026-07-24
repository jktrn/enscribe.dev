import { existsSync } from "node:fs"
import { join } from "node:path"

export const DEFAULT_LINK_ICON = "custom-external-link.svg"

const LINK_ICONS_BY_DOMAIN: Record<string, string> = {
  "bandcamp.com": "simple-bandcamp.svg",
}

const LINK_ICONS_BY_HOST: Record<string, string> = {
  "archive.org": "simple-internetarchive.svg",
  "arxiv.org": "simple-arxiv.svg",
  "codeforces.com": "simple-codeforces.svg",
  "codepen.io": "phosphor-codepen-logo.svg",
  "commons.wikimedia.org": "simple-wikimediacommons.svg",
  "ctftime.org": "phosphor-flag-banner.svg",
  "developer.mozilla.org": "simple-mdnwebdocs.svg",
  "docs.unity3d.com": "simple-unity.svg",
  "en.wikipedia.org": "simple-wikipedia.svg",
  "figma.com": "phosphor-figma-logo.svg",
  "geohints.com": "phosphor-map-pin.svg",
  "github.com": "phosphor-github-logo.svg",
  "google.com": "custom-google-logo.svg",
  "instagram.com": "phosphor-instagram-logo.svg",
  "japan-guide.com": "phosphor-map-trifold.svg",
  "jestjs.io": "simple-jest.svg",
  "lens.google": "simple-googlelens.svg",
  "osec.io": "custom-ottersec.svg",
  "reddit.com": "phosphor-reddit-logo.svg",
  "sekai.team": "custom-sekai.svg",
  "softwareengineering.stackexchange.com": "simple-stackexchange.svg",
  "somerandomstuff1.wordpress.com": "simple-wordpress.svg",
  "tabelog.com": "phosphor-fork-knife.svg",
  "twitter.com": "phosphor-twitter-logo.svg",
  "web.archive.org": "simple-internetarchive.svg",
  "youtube.com": "phosphor-youtube-logo.svg",
}

const normalizeHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/\.$/u, "")
    .replace(/^www\./u, "")

export const linkIconForHost = (host: string) => {
  const normalizedHost = normalizeHost(host)
  const domainIcon = Object.entries(LINK_ICONS_BY_DOMAIN).find(
    ([domain]) =>
      normalizedHost === domain || normalizedHost.endsWith(`.${domain}`),
  )?.[1]

  return LINK_ICONS_BY_HOST[normalizedHost] ?? domainIcon ?? DEFAULT_LINK_ICON
}

export const linkIconAssetDirectory = join(
  process.cwd(),
  "public/icons/favicons",
)

export const linkIconAssetPath = (asset: string) =>
  join(linkIconAssetDirectory, asset)

export const linkIconAssetUrl = (asset: string) => `/icons/favicons/${asset}`

export const assertLinkIconAsset = (asset: string) => {
  if (!existsSync(linkIconAssetPath(asset))) {
    throw new Error(
      `link-favicons: missing ${asset}; vendor it under public/icons/favicons`,
    )
  }
  return linkIconAssetUrl(asset)
}

export const linkIconAssets = [
  ...new Set([
    DEFAULT_LINK_ICON,
    ...Object.values(LINK_ICONS_BY_DOMAIN),
    ...Object.values(LINK_ICONS_BY_HOST),
  ]),
]
