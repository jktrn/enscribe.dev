import Image from '../Image'
import React, { useMemo } from 'react'
import { FaDiscord } from 'react-icons/fa'

const DiscordPresence = ({ lanyard }) => {
    const mainActivity = useMemo(() => {
        return lanyard.data.activities.filter(
            (activity) => activity.type === 0 && activity.assets
        )[0]
    }, [lanyard.data.activities])

    const hasMainActivity = useMemo(() => !!mainActivity, [mainActivity])

    const elapsedTime = useMemo(() => {
        return mainActivity && mainActivity.timestamps && mainActivity.timestamps.start
            ? getElapsedTime(mainActivity.timestamps.start)
            : ''
    }, [mainActivity])

    return (
        <>
            <div className="relative flex h-full w-full flex-col">
                <div className="absolute left-4 top-5">
                    <div className="relative">
                        <Image
                            className="size-24 rounded-full grayscale"
                            src="/static/images/avatar.webp"
                            alt="Discord Avatar"
                            width={96}
                            height={96}
                        />
                        {lanyard.data.discord_status === 'online' && (
                            <div className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full border-4 border-background bg-primary" />
                        )}
                        {lanyard.data.discord_status === 'idle' && (
                            <div className="absolute bottom-0 right-0 size-6 rounded-full border-4 border-background bg-primary">
                                <div className="size-[10px] rounded-full bg-background" />
                            </div>
                        )}
                        {lanyard.data.discord_status === 'dnd' && (
                            <div className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full border-4 border-background bg-destructive">
                                <div className="h-[4px] w-[11px] rounded-full bg-background" />
                            </div>
                        )}
                        {lanyard.data.discord_status === 'offline' && (
                            <div className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full border-4 border-background bg-muted-foreground">
                                <div className="size-2 rounded-full bg-background" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="absolute right-0 top-0 z-[1] m-3 flex size-14 items-center justify-center rounded-full bg-primary">
                    <FaDiscord size={50} className="p-1 text-secondary" />
                </div>
                <div className="h-[80px] w-full flex-shrink-0 rounded-t-3xl bg-tertiary/50" />
                <div className="m-3 flex h-full flex-col gap-3 overflow-scroll sm:overflow-hidden">
                    <div className="h-6 flex-shrink-0">
                        <div className="ml-auto flex h-full w-fit items-center rounded-lg bg-tertiary/50">
                            <Image
                                src="/static/images/bento/bento-discord-badges.svg"
                                alt="Discord Badges"
                                width={104}
                                height={24}
                                className="w-full rounded-lg grayscale"
                            />
                        </div>
                    </div>
                    <div className="h-fit rounded-lg bg-tertiary/50 p-2 text-sm leading-snug">
                        <div className="text-base">{lanyard.data.discord_user.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                            @{lanyard.data.discord_user.username}
                        </div>
                    </div>
                    <div className="flex h-full items-center gap-2 rounded-lg bg-tertiary/50 p-2 leading-snug">
                        {hasMainActivity ? (
                            <>
                                <div className="relative shrink-0">
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`}
                                        alt="Discord Activity Image"
                                        width={80}
                                        height={80}
                                        className="w-20 rounded-lg grayscale"
                                        quality={80}
                                    />
                                    <Image
                                        src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.small_image}.png`}
                                        alt="Now Playing"
                                        width={24}
                                        height={24}
                                        className="absolute -bottom-1 -right-1 size-6 rounded-full border-2 border-border grayscale"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <div className="line-clamp-1 text-xs leading-relaxed">
                                        {mainActivity.name}
                                    </div>
                                    <div className="line-clamp-1 text-[10px] text-muted-foreground">
                                        {mainActivity.details}
                                    </div>
                                    <div className="line-clamp-1 text-[10px] text-muted-foreground">
                                        {mainActivity.state}
                                    </div>
                                    {elapsedTime && (
                                        <div className="text-[11px] text-muted-foreground">
                                            {elapsedTime}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex size-full flex-col items-center justify-center gap-1">
                                <Image
                                    src="/static/images/bento/bento-discord-futon.svg"
                                    alt="No Status Image"
                                    width={64}
                                    height={64}
                                    className="h-full w-fit rounded-lg"
                                />
                                <div className="text-[10px] text-muted-foreground">No status!</div>
                            </div>
                        )}
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

    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')} elapsed`
}

export default DiscordPresence
