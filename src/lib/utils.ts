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

export function readingTime(html: string) {
  const textOnly = html.replace(/<[^>]+>/g, '')
  const wordCount = textOnly.split(/\s+/).length
  const readingTimeMinutes = (wordCount / 200 + 1).toFixed()
  return `${readingTimeMinutes} min read`
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
