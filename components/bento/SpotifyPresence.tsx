import React, { useEffect } from 'react'
import { set } from 'react-use-lanyard'
import Image from 'next/image'
import { MoveUpRight } from 'lucide-react'
import Link from '../Link'

const SpotifyPresence = ({ lanyard }) => {
    useEffect(() => {
        if (
            JSON.parse(lanyard.data.kv.spotify_last_played) !== lanyard.data.spotify &&
            lanyard.data.listening_to_spotify
        ) {
            const setLastPlayed = async () => {
                try {
                    await set({
                        apiKey: process.env.NEXT_PUBLIC_LANYARD_KV_KEY!,
                        userId: "747519888347627550",
                        key: 'spotify_last_played',
                        value: JSON.stringify(lanyard.data.spotify),
                    })
                } catch (error) {
                    console.error('Error setting KV pair:', error)
                }
            }

            setLastPlayed()
        }
    }, [lanyard.data.spotify])

    let displayData = lanyard.data.spotify
    if (!displayData && lanyard.data.kv.spotify_last_played) {
        displayData = JSON.parse(lanyard.data.kv.spotify_last_played)
    }

    if (!displayData) return <p>Something absolutely horrible has gone wrong</p>

    const { song, artist, album, album_art_url, track_id } = displayData

    return (
        <>
            <div className="flex h-full w-full flex-col justify-between p-6">
                <Image
                    src={album_art_url}
                    alt="Album art"
                    width={0}
                    height={0}
                    className="mb-2 w-[55%] rounded-xl border border-border grayscale"
                    unoptimized
                />
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
                    <span className="text-md mb-2 line-clamp-2 font-bold leading-none">{song}</span>
                    <span className="line-clamp-2 w-[85%] text-xs text-muted-foreground">
                        <span className="opacity-80">by</span> {artist}
                    </span>
                    <span className="line-clamp-2 w-[85%] text-xs text-muted-foreground">
                        <span className="opacity-80">on</span> {album}
                    </span>
                </div>
            </div>

            <Link href={`https://open.spotify.com/track/${track_id}`} className="block">
                <div className="absolute bottom-0 right-0 m-3 flex w-fit items-end rounded-full border border-border bg-tertiary/50 p-3 text-primary transition-all duration-300 hover:brightness-125">
                    <MoveUpRight size={16} />
                </div>
            </Link>
        </>
    )
}

export default SpotifyPresence
