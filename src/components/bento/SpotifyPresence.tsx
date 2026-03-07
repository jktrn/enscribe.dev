import { useEffect, useState, useRef, useCallback } from 'react'
import { FaSpotify } from 'react-icons/fa'
import { Skeleton } from '@/components/ui/skeleton'
import { MoveUpRight, AudioLines } from 'lucide-react'

const SSE_URL = 'https://jason-you-owe-me-money.es3n1n.eu/v1/spotify/stream'

interface TrackImage {
  width: number
  height: number
  url: string
}

interface Album {
  name: string
  url: string
  images: TrackImage[]
  release_date: string
  total_tracks: number
}

interface Track {
  id: string
  artist: string
  title: string
  url: string
  album: Album
  duration_ms: number
}

interface Playback {
  is_playing: boolean
  progress_ms: number
  timestamp_ms: number
  track: Track
}

interface LyricLine {
  start_time_ms: number
  end_time_ms: number
  words: string
}

interface Lyrics {
  sync_type: string
  lines: LyricLine[]
  provider: string
}

interface SpotifyState {
  playback: Playback | null
  lyrics: Lyrics | null
  isPlaying: boolean
  connected: boolean
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getCurrentLyricLine(
  lyrics: Lyrics | null,
  progressMs: number,
): string | null {
  if (!lyrics || !lyrics.lines.length) return null

  const nonEmptyLines = lyrics.lines.filter((l) => l.words.trim() !== '')
  if (!nonEmptyLines.length) return null

  let current: LyricLine | null = null
  for (let i = nonEmptyLines.length - 1; i >= 0; i--) {
    if (progressMs >= nonEmptyLines[i].start_time_ms) {
      current = nonEmptyLines[i]
      break
    }
  }

  return current?.words ?? null
}

const SpotifyPresence = () => {
  const [state, setState] = useState<SpotifyState>({
    playback: null,
    lyrics: null,
    isPlaying: false,
    connected: false,
  })
  const [progressMs, setProgressMs] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const progressRef = useRef({ progressMs: 0, timestampMs: 0 })
  const rafRef = useRef<number>(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  const updateProgress = useCallback(() => {
    const { progressMs: baseProgress, timestampMs } = progressRef.current
    if (state.isPlaying && timestampMs > 0) {
      const elapsed = Date.now() - timestampMs
      const currentProgress = Math.min(
        baseProgress + elapsed,
        state.playback?.track.duration_ms ?? Infinity,
      )
      setProgressMs(currentProgress)
    }
    rafRef.current = requestAnimationFrame(updateProgress)
  }, [state.isPlaying, state.playback?.track.duration_ms])

  useEffect(() => {
    if (state.isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [state.isPlaying, updateProgress])

  useEffect(() => {
    const connect = () => {
      const es = new EventSource(SSE_URL)
      eventSourceRef.current = es

      es.onopen = () => {
        setState((prev) => ({ ...prev, connected: true }))
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.event_type === 'keepalive') return

          if (data.event_type === 'no_playback') {
            setState((prev) => ({ ...prev, isPlaying: false, connected: true }))
            setIsLoading(false)
            return
          }

          if (data.playback) {
            const playback: Playback = data.playback
            progressRef.current = {
              progressMs: playback.progress_ms,
              timestampMs: Date.now(),
            }
            setProgressMs(playback.progress_ms)

            setState((prev) => ({
              ...prev,
              playback,
              isPlaying: playback.is_playing,
              connected: true,
              ...(data.lyrics !== undefined ? { lyrics: data.lyrics } : {}),
            }))
            setIsLoading(false)
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e)
        }
      }

      es.onerror = () => {
        es.close()
        setState((prev) => ({ ...prev, connected: false }))
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const currentLyric = getCurrentLyricLine(state.lyrics, progressMs)
  const track = state.playback?.track
  const durationMs = track?.duration_ms ?? 0
  const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0

  if (isLoading && !track) {
    return (
      <div className="relative flex h-full w-full flex-col justify-between p-6">
        <Skeleton className="mb-2 size-[60%]" />
        <div className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="text-foreground absolute top-0 right-0 m-3">
          <FaSpotify size={56} />
        </div>
        <Skeleton className="absolute right-0 bottom-0 m-3 h-10 w-10 rounded-full" />
      </div>
    )
  }

  if (!track) {
    return (
      <div className="relative flex h-full w-full flex-col justify-between p-6">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <FaSpotify
              size={48}
              className="text-muted-foreground mx-auto mb-4"
            />
            <p className="text-muted-foreground text-sm">
              No music data available
            </p>
          </div>
        </div>
        <div className="text-foreground absolute top-0 right-0 m-3">
          <FaSpotify size={56} />
        </div>
      </div>
    )
  }

  const albumArt = track.album.images[0]?.url

  return (
    <>
      <div className="relative flex size-full flex-col gap-4 p-6 pb-5">
        <div className="min-h-0 flex-1">
          <div
            className="aspect-square h-full border bg-cover bg-center grayscale sepia-50"
            style={{ backgroundImage: albumArt ? `url(${albumArt})` : undefined }}
            role="img"
            aria-label="Album art"
          />
        </div>
        <div className="shrink-0">
          <div className="flex flex-col">
            <span className="mb-2 flex items-center gap-2">
              <AudioLines size={12} className="text-primary shrink-0" />
              <span className="text-primary text-xs">
                {state.isPlaying ? 'Now playing...' : 'Last played...'}
              </span>
            </span>
            <span className="text-md mb-1 mr-14 line-clamp-2 leading-tight font-medium">
              {track.title}
            </span>
            <span className="text-muted-foreground mr-10 line-clamp-1 text-xs">
              <span className="text-muted-foreground">by</span> {track.artist}
            </span>
            <span className="text-muted-foreground mr-10 line-clamp-1 text-xs">
              <span className="text-muted-foreground">on</span> {track.album.name}
            </span>
            {currentLyric && state.isPlaying && (
              <span className="text-muted-foreground mt-2 line-clamp-1 text-xs italic">
                {currentLyric}
              </span>
            )}
          </div>
          {state.isPlaying && (
            <div className="mt-3 mr-10">
              <div className="bg-border h-0.5 overflow-hidden">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                <span>{formatMs(progressMs)}</span>
                <span>{formatMs(durationMs)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="text-primary absolute top-0 right-0 m-3">
        <FaSpotify size={56} />
      </div>
      <a
        href={track.url}
        aria-label="View on Spotify"
        title="View on Spotify"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-border/50 text-primary ring-ring group/spotify-link absolute end-0 bottom-0 m-3 rounded-full p-3 transition-[box-shadow] duration-300 hover:ring-2 focus-visible:ring-2"
      >
        <MoveUpRight
          size={16}
          className="transition-transform duration-300 group-hover/spotify-link:rotate-12"
        />
      </a>
    </>
  )
}

export default SpotifyPresence
