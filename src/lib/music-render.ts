import { assertLinkIconAsset, linkIconForHost } from "@/lib/link-icons"
import type { Concert, ConcertArtist } from "@/lib/music"
import { concertDate } from "@/lib/music"
import { renderInline } from "@/lib/markdown/inline-markdown"
import { formatDateParts } from "@/lib/utils"
import { ATTRIBUTES } from "@enscribe/linebreak/attributes"

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  )

const renderPart = async (
  value: string,
  offset: number,
  acronymBoundary?: number,
) => {
  if (
    acronymBoundary === undefined ||
    acronymBoundary <= offset ||
    acronymBoundary >= offset + value.length
  ) {
    return renderInline(value)
  }

  const localBoundary = acronymBoundary - offset
  const [before, after] = await Promise.all([
    renderInline(value.slice(0, localBoundary)),
    renderInline(value.slice(localBoundary)),
  ])
  return `${before}${after}`
}

const renderLink = async ({
  href,
  label,
  acronymPrefix,
}: {
  href: string
  label: string
  acronymPrefix?: string
}) => {
  const asset = linkIconForHost(new URL(href).hostname)
  const assetUrl = assertLinkIconAsset(asset)
  const suffix = /(\S{1,8})(\s*)$/u.exec(label)
  const before = suffix ? label.slice(0, suffix.index) : ""
  const beforeSpacing = /\s*$/u.exec(before)?.[0] ?? ""
  const beforeText = before.slice(0, before.length - beforeSpacing.length)
  const ending = suffix?.[1] ?? label
  const trailing = suffix?.[2] ?? ""
  const acronymBoundary =
    acronymPrefix && label.startsWith(acronymPrefix)
      ? acronymPrefix.length
      : undefined
  const beforeHtml = beforeText
    ? await renderPart(beforeText, 0, acronymBoundary)
    : ""
  const endingHtml = await renderPart(ending, before.length, acronymBoundary)
  const favicon = `<span aria-hidden="true" data-favicon="" data-favicon-position="after" ${ATTRIBUTES.decoration}="" ${ATTRIBUTES.decorationPosition}="after" data-favicon-icon="${escapeHtml(asset)}" style='--favicon-mask:url("${escapeHtml(assetUrl)}")'></span>`
  const content = `${beforeHtml}${beforeSpacing}<span ${ATTRIBUTES.atom}="" data-favicon-glue="">${endingHtml}${favicon}</span>${trailing}`

  return `<a href="${escapeHtml(href)}" target="_blank" rel="nofollow noreferrer noopener">${content}</a>`
}

const renderArtist = async (artist: ConcertArtist, connector: string) => {
  const link = await renderLink({
    href: artist.url,
    label: artist.name,
    acronymPrefix: artist.acronymPrefix,
  })
  const formerName = artist.formerName
    ? ` (<abbr title="formerly known as">fka</abbr> ${escapeHtml(artist.formerName)})`
    : ""
  return `${connector}${link}${formerName}`
}

export const renderConcertEntry = async (concert: Concert) => {
  const artistHtml: string[] = []

  for (const [index, artist] of concert.artists.entries()) {
    const previous = concert.artists[index - 1]
    const connector =
      index === 0
        ? ""
        : previous?.b2bWithNext
          ? ' <abbr title="back to back">b2b</abbr> '
          : ", "
    artistHtml.push(await renderArtist(artist, connector))
  }

  const date = concertDate(concert.date)
  const { month, day, suffix, year } = formatDateParts(date)
  const dateHtml = `<time datetime="${date.toISOString()}">${month} <span data-ordinal>${day}${suffix}</span>, ${year}</time>`
  const venue = await renderLink({
    href: concert.venue.url,
    label: concert.venue.name,
  })
  const source = await renderLink({
    href: concert.source.url,
    label: concert.source.label,
  })
  const event = concert.event ? `${escapeHtml(concert.event)}: ` : ""

  const genres = concert.genres.map(escapeHtml).join(", ")

  return `${event}${artistHtml.join("")}<br>${dateHtml} <span data-music-separator>@</span> ${venue}<span data-music-separator>,</span> <span data-music-city>${escapeHtml(concert.venue.city)}</span> <span data-parenthetical>(${source})</span><br><span data-music-genres>${genres}</span>`
}
