import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'

const DiscordPresence = ({ lanyard, onLoad }) => {
    const mainActivity = lanyard.data.activities.filter(
        (activity) => activity.type === 0 && activity.assets
    )[0]

    const hasMainActivity = !!mainActivity

    const [elapsedTime, setElapsedTime] = useState<string>(
        mainActivity && mainActivity.timestamps && mainActivity.timestamps.start
            ? getElapsedTime(mainActivity.timestamps.start)
            : ''
    )

    useEffect(() => {
        if (mainActivity && mainActivity.timestamps && mainActivity.timestamps.start) {
            const interval = setInterval(() => {
                setElapsedTime(getElapsedTime(mainActivity.timestamps.start))
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [mainActivity, mainActivity?.timestamps?.start])

    useEffect(() => {
        if (hasMainActivity && onLoad) {
            onLoad()
        }
    }, [hasMainActivity, onLoad])

    return (
        <>
            <div className="flex bento-md:hidden bento-lg:relative bento-lg:flex w-full h-full flex-col">
                <div className="absolute top-5 left-4">
                    <div className="relative">
                        <Image
                            className="rounded-full grayscale w-24 h-24"
                            src={`https://api.lanyard.rest/${lanyard.data.discord_user.id}.png`}
                            alt="Discord Avatar"
                            width={0}
                            height={0}
                            unoptimized
                        />
                        {lanyard.data.discord_status === 'online' && (
                            <div className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary border-4 border-background" />
                        )}
                        {lanyard.data.discord_status === 'idle' && (
                            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary border-4 border-background">
                                <div className="bg-background w-[10px] h-[10px] rounded-full" />
                            </div>
                        )}
                        {lanyard.data.discord_status === 'dnd' && (
                            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-destructive flex items-center justify-center border-4 border-background">
                                <div className="bg-background w-[11px] h-[4px] rounded-full" />
                            </div>
                        )}
                        {lanyard.data.discord_status === 'offline' && (
                            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-muted-foreground flex items-center justify-center border-4 border-background">
                                <div className="bg-background w-2 h-2 rounded-full" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="absolute right-0 top-0 z-[1] w-14 h-14 flex items-center justify-center m-3 rounded-full bg-primary">
                    <FaDiscord size={50} className="text-secondary p-1" />
                </div>
                <div className="bg-tertiary/50 w-full h-[80px] rounded-t-3xl flex-shrink-0" />
                <div className="m-3 flex flex-col h-full gap-3 overflow-scroll bento-md:overflow-hidden">
                    <div className="h-6 flex-shrink-0">
                        <div className="bg-tertiary/50 rounded-lg w-fit h-full ml-auto flex items-center">
                            <Image
                                src="/static/images/bento/bento-discord-badges.svg"
                                alt="Discord Badges"
                                width={0}
                                height={0}
                                className="w-full rounded-lg grayscale"
                            />
                        </div>
                    </div>
                    <div className="text-sm h-fit px-2 py-1 rounded-lg bg-tertiary/50 leading-snug">
                        <div>{lanyard.data.discord_user.display_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                            @{lanyard.data.discord_user.username}
                        </div>
                    </div>
                    <div className="flex h-full p-2 rounded-lg bg-tertiary/50 leading-snug gap-2 items-center">
                        {hasMainActivity ? (
                            <>
                                <div className="relative">
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`}
                                        alt="Discord Activity Image"
                                        width={0}
                                        height={0}
                                        className="w-16 rounded-lg grayscale"
                                        unoptimized
                                    />
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.small_image}.png`}
                                        alt="Now Playing"
                                        width={0}
                                        height={0}
                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-border grayscale"
                                        unoptimized
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-xs leading-relaxed line-clamp-1">
                                        {mainActivity.name}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                                        {mainActivity.details}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                                        {mainActivity.state}
                                    </div>
                                    {elapsedTime && (
                                        <div className="text-[10px] text-muted-foreground">
                                            {elapsedTime}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full gap-1">
                                <Image
                                    src="/static/images/bento/bento-discord-futon.svg"
                                    alt="No Status Image"
                                    width={0}
                                    height={0}
                                    className="h-full w-fit rounded-lg"
                                />
                                <div className="text-[10px] text-muted-foreground">No status!</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="hidden bento-md:flex bento-md:relative bento-lg:hidden w-full h-full flex-col">
                <div className="flex flex-col h-full gap-2 m-2 justify-between">
                    <div className="flex gap-2 items-center">
                        <div className="flex-shrink-0">
                            <div className="relative">
                                <Image
                                    className="w-[55px] h-[55px] bento-md:w-[70px] bento-md:h-[70px] rounded-full grayscale"
                                    src={`https://api.lanyard.rest/${lanyard.data.discord_user.id}.png`}
                                    alt="Discord Avatar"
                                    width={96}
                                    height={96}
                                    unoptimized
                                />
                                {lanyard.data.discord_status === 'online' && (
                                    <div className="absolute -bottom-0 right-0 w-5 h-5 flex items-center justify-center rounded-full bg-primary border-4 border-background" />
                                )}
                                {lanyard.data.discord_status === 'idle' && (
                                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary border-4 border-background">
                                        <div className="bg-background w-[7px] h-[7px] rounded-full" />
                                    </div>
                                )}
                                {lanyard.data.discord_status === 'dnd' && (
                                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-destructive flex items-center justify-center border-4 border-background">
                                        <div className="bg-background w-2 h-1 rounded-full" />
                                    </div>
                                )}
                                {lanyard.data.discord_status === 'offline' && (
                                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-muted-foreground flex items-center justify-center border-4 border-background">
                                        <div className="bg-background w-[6px] h-[6px] rounded-full" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-sm leading-snug ml-1">
                                <div>{lanyard.data.discord_user.display_name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                    @{lanyard.data.discord_user.username}
                                </div>
                            </div>
                            <Image
                                src="/static/images/bento/bento-discord-badges.svg"
                                alt="Discord Badges"
                                width={0}
                                height={0}
                                className="h-full w-full rounded-md grayscale"
                            />
                        </div>
                    </div>
                    <div className="flex h-full py-1 px-2 bento-md:p-2 bg-tertiary/50 leading-snug gap-2 items-center rounded-2xl">
                        {hasMainActivity ? (
                            <>
                                <div className="relative flex-shrink-0">
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`}
                                        alt="Discord Activity Image"
                                        width={0}
                                        height={0}
                                        className="w-16 rounded-lg grayscale"
                                        unoptimized
                                    />
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.small_image}.png`}
                                        alt="Now Playing"
                                        width={0}
                                        height={0}
                                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-border grayscale"
                                        unoptimized
                                    />
                                </div>
                                <div className="flex flex-col w-full">
                                    <div className="text-xs leading-relaxed line-clamp-1">
                                        {mainActivity.name}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                                        {mainActivity.details}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                                        {mainActivity.state}
                                    </div>
                                    {elapsedTime && (
                                        <div className="text-[10px] text-muted-foreground">
                                            {elapsedTime}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full">
                                <Image
                                    src="/static/images/bento/bento-discord-futon.svg"
                                    alt="No Status Image"
                                    width={0}
                                    height={0}
                                    className="h-full w-fit rounded-lg"
                                />
                                <div className="text-[10px] text-muted-foreground">No status!</div>
                            </div>
                        )}
                    </div>
                    <div className="absolute right-0 top-0 w-14 h-14 flex items-center justify-center m-3 rounded-full bg-primary">
                        <FaDiscord size={50} className="text-secondary p-1" />
                    </div>
                </div>
            </div>
        </>
    )
}

function getElapsedTime(unixTimestamp: number): string {
    const createdAt = new Date(unixTimestamp)
    const now = new Date()
    let difference = now.getTime() - createdAt.getTime()

    const hours = Math.floor(difference / (1000 * 60 * 60))
    difference -= hours * (1000 * 60 * 60)

    const minutes = Math.floor(difference / (1000 * 60))
    difference -= minutes * (1000 * 60)

    const seconds = Math.floor(difference / 1000)

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')} elapsed`
}

export default DiscordPresence
