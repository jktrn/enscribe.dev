import Image from 'next/image'
import React, { useEffect } from 'react'
import { FaSpotify } from 'react-icons/fa'
import { set } from 'react-use-lanyard'

import ExternalLink from './ExternalLink'

const SpotifyPresence = ({ lanyard, onLoad }) => {
    const setLastPlayed = async () => {
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
    }

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
    ])

    let displayData = lanyard.data.spotify
    if (!displayData && lanyard.data.kv.spotify_last_played) {
        displayData = JSON.parse(lanyard.data.kv.spotify_last_played)
    }

    useEffect(() => {
        if (displayData && onLoad) {
            onLoad()
        }
    }, [displayData, onLoad])

    if (!displayData) return <p>Something absolutely horrible has gone wrong</p>

    const { song, artist, album, album_art_url, track_id } = displayData

    return (
        <>
            <div className="flex bento-md:hidden z-[1] bento-lg:flex h-full w-full flex-col justify-between p-6">
                <Image
                    src={album_art_url}
                    alt="Album art"
                    width={0}
                    height={0}
                    className="mb-2 w-[55%] rounded-xl border border-border grayscale"
                    unoptimized
                />
                <div className="overflow-scroll bento-md:overflow-hidden">
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
                        <span className="text-md mb-2 line-clamp-2 font-bold leading-none">
                            {song}
                        </span>
                        <span className="line-clamp-1 w-[85%] text-xs text-muted-foreground">
                            <span className="text-secondary-foreground font-semibold">by</span>{' '}
                            {artist}
                        </span>
                        <span className="line-clamp-1 w-[85%] text-xs text-muted-foreground">
                            <span className="text-secondary-foreground font-semibold">on</span>{' '}
                            {album}
                        </span>
                    </div>
                </div>
            </div>
            <div className="hidden bento-md:flex z-[1] bento-lg:hidden h-full w-full px-4 items-center gap-4">
                <Image
                    src={album_art_url}
                    alt="Album art"
                    width={0}
                    height={0}
                    className="w-32 rounded-xl border border-border grayscale"
                    unoptimized
                />
                <div className="flex flex-col w-[42%]">
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
                    <span className="text-md mb-2 line-clamp-3 font-bold leading-none">{song}</span>
                    <span className="line-clamp-2 w-[85%] text-xs text-muted-foreground">
                        <span className="text-secondary-foreground font-semibold">by</span> {artist}
                    </span>
                    <span className="line-clamp-2 w-[85%] text-xs text-muted-foreground">
                        <span className="text-secondary-foreground font-semibold">on</span> {album}
                    </span>
                </div>
            </div>
            <div className="absolute right-0 top-0 z-[1] m-3 text-primary">
                <FaSpotify size={56} />
            </div>
            <ExternalLink
                href={`https://open.spotify.com/track/${track_id}`}
                className="z-[1] block"
            />
        </>
    )
}

export default SpotifyPresence
