import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function formatMonthYear(date: Date) {
  return Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
  }).format(date)
}

export function calculateWordCountFromHtml(
  html: string | null | undefined,
): number {
  if (!html) return 0
  const textOnly = html.replace(/<[^>]+>/g, '')
  return textOnly.split(/\s+/).filter(Boolean).length
}

export function readingTime(wordCount: number): string {
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200))
  return `${readingTimeMinutes} min read`
}

export function getHeadingMargin(depth: number): string {
  const margins: Record<number, string> = {
    3: 'ml-4',
    4: 'ml-8',
    5: 'ml-12',
    6: 'ml-16',
  }
  return margins[depth] || ''
}

export function getElapsedTime(unixTimestamp: number): string {
  const createdAt = new Date(unixTimestamp)
  const now = new Date()
  let difference = now.getTime() - createdAt.getTime()
  const hours = Math.floor(difference / (1000 * 60 * 60))
  difference -= hours * (1000 * 60 * 60)
  const minutes = Math.floor(difference / (1000 * 60))
  difference -= minutes * (1000 * 60)
  const seconds = Math.floor(difference / 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')} elapsed`
}

export function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.startsWith('www.') ? domain.slice(4) : domain
  } catch {
    return url
  }
}
