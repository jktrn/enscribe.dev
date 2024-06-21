import Image from '../Image'
import React, { useCallback, useEffect, useMemo } from 'react'
import { FaSpotify } from 'react-icons/fa'
import { set } from 'react-use-lanyard'

import ExternalLink from './ExternalLink'

const SpotifyPresence = ({ lanyard }) => {
    const setLastPlayed = useCallback(async () => {
        try {
            await set({
                apiKey: process.env.NEXT_PUBLIC_LANYARD_KV_KEY!,
                userId: '747519888347627550',
                key: 'spotify_last_played',
                value: JSON.stringify(lanyard.data.spotify),
            })
        } catch (error) {
            console.error('Error setting KV pair:', error)
        }
    }, [lanyard.data.spotify])

    const displayData = useMemo(() => {
        if (lanyard.data.spotify) {
            return lanyard.data.spotify
        }
        if (lanyard.data.kv.spotify_last_played) {
            return JSON.parse(lanyard.data.kv.spotify_last_played)
        }
        return null
    }, [lanyard.data.spotify, lanyard.data.kv.spotify_last_played])

    useEffect(() => {
        if (
            JSON.parse(lanyard.data.kv.spotify_last_played) !== lanyard.data.spotify &&
            lanyard.data.listening_to_spotify
        ) {
            setLastPlayed()
        }
    }, [
        lanyard.data.spotify,
        lanyard.data.listening_to_spotify,
        lanyard.data.kv.spotify_last_played,
        setLastPlayed,
    ])

    if (!displayData) return <p>Something absolutely horrible has gone wrong</p>

    const { song, artist, album, album_art_url, track_id } = displayData

    return (
        <>
            <div className="relative flex h-full w-full flex-col justify-between p-6">
                <Image
                    src={album_art_url}
                    alt="Album art"
                    width={128}
                    height={128}
                    className="mb-2 w-[55%] rounded-xl border border-border grayscale"
                    quality={80}
                />
                <div className="overflow-visible">
                    <div className="flex flex-col">
                        <span className="mb-2 flex gap-2">
                            <Image
                                src="/static/images/bento/bento-now-playing.svg"
                                alt="Now playing"
                                width={16}
                                height={16}
                            />
                            {lanyard.data.listening_to_spotify ? (
                                <span className="text-sm text-primary">Now playing...</span>
                            ) : (
                                <span className="text-sm text-primary">Last played...</span>
                            )}
                        </span>
                        <span className="text-md mb-2 line-clamp-1 font-bold leading-none">
                            {song}
                        </span>
                        <span className="line-clamp-1 w-[85%] text-xs text-muted-foreground">
                            <span className="font-semibold text-secondary-foreground">by</span>{' '}
                            {artist}
                        </span>
                        <span className="line-clamp-1 w-[85%] text-xs text-muted-foreground">
                            <span className="font-semibold text-secondary-foreground">on</span>{' '}
                            {album}
                        </span>
                    </div>
                </div>
            </div>
            <div className="absolute right-0 top-0 m-3 text-primary">
                <FaSpotify size={56} />
            </div>
            <ExternalLink
                href={`https://open.spotify.com/track/${track_id}`}
                aria-label="Open in Spotify"
                title="Open in Spotify"
            />
        </>
    )
}

export default SpotifyPresence
