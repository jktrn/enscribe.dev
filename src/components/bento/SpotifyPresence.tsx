import { useEffect, useState, useRef } from 'react'
import { FaSpotify } from 'react-icons/fa'
import { Skeleton } from '@/components/ui/skeleton'
import { MoveUpRight, AudioLines } from 'lucide-react'

interface Track {
  name: string
  artist: { '#text': string }
  album: { '#text': string }
  image: { '#text': string }[]
  url: string
  '@attr'?: { nowplaying: string }
}

interface CachedData {
  track: Track
  timestamp: number
}

const CACHE_KEY = 'spotify-presence-cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const RETRY_DELAY = 2000 // 2 seconds
const MAX_RETRIES = 3

const SpotifyPresence = () => {
  const [displayData, setDisplayData] = useState<Track | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const retryCountRef = useRef(0)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const getCachedData = (): Track | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsedCache: CachedData = JSON.parse(cached)
        const isExpired = Date.now() - parsedCache.timestamp > CACHE_DURATION
        if (!isExpired) {
          return parsedCache.track
        }
      }
    } catch (error) {
      console.warn('Failed to parse cached data:', error)
      localStorage.removeItem(CACHE_KEY)
    }
    return null
  }

  const setCachedData = (track: Track) => {
    try {
      const cacheData: CachedData = {
        track,
        timestamp: Date.now(),
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to cache data:', error)
    }
  }

  const fetchWithRetry = async (retryCount = 0): Promise<void> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(
        'https://lastfm-last-played.biancarosa.com.br/enscribe/latest-song',
        {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
          },
        },
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.track) {
        setDisplayData(data.track)
        setCachedData(data.track)
        setError(null)
        retryCountRef.current = 0
      } else {
        throw new Error('No track data received')
      }
    } catch (fetchError) {
      console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError)

      if (retryCount < MAX_RETRIES) {
        retryCountRef.current = retryCount + 1

        fetchTimeoutRef.current = setTimeout(
          () => {
            fetchWithRetry(retryCount + 1)
          },
          RETRY_DELAY * (retryCount + 1),
        )
      } else {
        setError('Failed to load music data')
        retryCountRef.current = 0
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const cachedTrack = getCachedData()
    if (cachedTrack) {
      setDisplayData(cachedTrack)
      setIsLoading(false)
      setError(null)

      fetchWithRetry().catch(() => {})
    } else {
      fetchWithRetry()
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading && !displayData) {
    return (
      <div className="relative flex h-full w-full flex-col justify-between p-6">
        <Skeleton className="mb-2 size-[60%]" />
        <div className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <div className="text-foreground absolute top-0 right-0 m-3">
          <FaSpotify size={56} />
        </div>
        <Skeleton className="absolute right-0 bottom-0 m-3 h-10 w-10 rounded-full" />
      </div>
    )
  }

  if (!displayData) {
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

  const { name: song, artist, album, image, url } = displayData

  return (
    <>
      <div className="relative flex size-full flex-col justify-between gap-4 p-6">
        <div
          className="aspect-square min-h-0 max-w-[60%] flex-shrink border bg-cover bg-center grayscale sepia-50"
          style={{
            backgroundImage: `url(${image[3]['#text']})`,
          }}
          role="img"
          aria-label="Album art"
        />
        <div className="flex min-h-0 flex-shrink-0 flex-col justify-end">
          <div className="mr-8 flex flex-col">
            <span className="mb-2 flex items-center gap-2">
              <AudioLines size={16} className="text-primary" />
              <span className="text-primary text-sm">
                {displayData['@attr']?.nowplaying === 'true'
                  ? 'Now playing...'
                  : 'Last played...'}
              </span>
            </span>
            <span className="text-md mb-2 line-clamp-2 leading-tight font-medium">
              {song}
            </span>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              <span className="text-muted-foreground">by</span>{' '}
              {artist['#text']}
            </span>
            <span className="text-muted-foreground line-clamp-1 text-xs">
              <span className="text-muted-foreground">on</span> {album['#text']}
            </span>
          </div>
        </div>
      </div>
      <div className="text-primary absolute top-0 right-0 m-3">
        <FaSpotify size={56} />
      </div>
      <a
        href={url}
        aria-label="View on last.fm"
        title="View on last.fm"
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
