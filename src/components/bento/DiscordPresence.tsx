import { useMemo, useState, useEffect } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { useLanyard } from 'react-use-lanyard'
import { Skeleton } from '../ui/skeleton'
import { cn, getElapsedTime } from '@/lib/utils'
import AvatarComponent from '@/components/ui/avatar'

const DiscordPresence = () => {
  const { data: lanyard, isLoading } = useLanyard({
    userId: '747519888347627550',
  })

  const mainActivity = useMemo(() => {
    if (!lanyard?.data?.activities) return null
    return lanyard.data.activities.find(
      (activity) => activity.type === 0 && activity.assets,
    )
  }, [lanyard?.data?.activities])

  const hasMainActivity = !!mainActivity

  const [elapsedTime, setElapsedTime] = useState('')

  useEffect(() => {
    if (!mainActivity?.timestamps?.start) return

    const updateElapsedTime = () => {
      if (mainActivity.timestamps?.start) {
        setElapsedTime(getElapsedTime(mainActivity.timestamps.start))
      }
    }

    updateElapsedTime()
    const intervalId = setInterval(updateElapsedTime, 1000)

    return () => clearInterval(intervalId)
  }, [mainActivity])

  if (isLoading) {
    return (
      <div className="relative overflow-hidden sm:aspect-square">
        <div className="grid size-full grid-rows-4">
          <Skeleton className="bg-secondary/50" />
          <div className="row-span-3 flex flex-col gap-3 p-3">
            <div className="flex justify-between gap-x-1">
              <Skeleton className="-mt-[4.5rem] aspect-square size-24 rounded-full" />
              <Skeleton className="h-6 w-[104px] rounded-xl" />
            </div>
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="flex grow rounded-xl" />
          </div>
        </div>
        <Skeleton className="absolute right-0 top-0 z-[1] m-3 size-14 rounded-full" />
      </div>
    )
  }

  if (!lanyard || !lanyard.data) {
    return null
  }

  return (
    <div className="relative overflow-hidden sm:aspect-square">
      <div className="grid size-full grid-rows-4">
        <div className="bg-secondary/50"></div>
        <div className="row-span-3 flex flex-col gap-3 p-3">
          <div className="flex justify-between gap-x-1">
            <div className="relative">
              <AvatarComponent
                src="/static/avatar.webp"
                alt="Avatar"
                fallback="e"
                className="-mt-[4.5rem] aspect-square size-24 rounded-full"
              />
              <div
                className={cn(
                  'absolute bottom-0 right-0 size-6 rounded-full border-4 border-background',
                  {
                    'flex items-center justify-center bg-primary':
                      lanyard.data.discord_status === 'online',
                    'bg-primary': lanyard.data.discord_status === 'idle',
                    'flex items-center justify-center bg-destructive':
                      lanyard.data.discord_status === 'dnd',
                    'flex items-center justify-center bg-muted-foreground':
                      lanyard.data.discord_status === 'offline',
                  },
                )}
              >
                {lanyard.data.discord_status === 'idle' && (
                  <div className="size-[10px] rounded-full bg-background" />
                )}
                {lanyard.data.discord_status === 'dnd' && (
                  <div className="h-[4px] w-[11px] rounded-full bg-background" />
                )}
                {lanyard.data.discord_status === 'offline' && (
                  <div className="size-2 rounded-full bg-background" />
                )}
              </div>
            </div>
            <div className="flex items-center rounded-xl bg-secondary/50 px-2">
              <img
                src="/static/bento/badges.png"
                alt="Discord Badges"
                width={104}
                height={24}
                className="grayscale"
              />
            </div>
          </div>
          <div className="flex flex-col gap-y-1 rounded-xl bg-secondary/50 p-3">
            <span className="text-base leading-none">enscribe</span>
            <span className="text-xs leading-none text-muted-foreground">
              @enscribe
            </span>
          </div>
          <div className="flex grow rounded-xl bg-secondary/50 px-3 py-2">
            {hasMainActivity && mainActivity && mainActivity.assets ? (
              <div className="flex w-full items-center gap-x-3">
                <div
                  className="relative aspect-square h-full w-auto flex-shrink-0 rounded-md bg-contain grayscale invert"
                  style={{
                    backgroundImage: `url('https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png')`,
                  }}
                >
                  {mainActivity.assets.small_image && (
                    <img
                      src={`https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.small_image}.png`}
                      alt="Now Playing"
                      width={20}
                      height={20}
                      className="absolute -bottom-1 -right-1 rounded-full border-2 grayscale invert"
                    />
                  )}
                </div>
                <div className="my-2 flex min-w-0 flex-1 flex-col gap-y-1 overflow-hidden">
                  {mainActivity.name && (
                    <div className="mb-0.5 truncate text-xs leading-none">
                      {mainActivity.name}
                    </div>
                  )}
                  {mainActivity.details && (
                    <div className="truncate text-[10px] leading-none text-muted-foreground">
                      {mainActivity.details}
                    </div>
                  )}
                  {mainActivity.state && (
                    <div className="truncate text-[10px] leading-none text-muted-foreground">
                      {mainActivity.state}
                    </div>
                  )}
                  {elapsedTime && (
                    <div className="text-[11px] leading-none text-muted-foreground">
                      {elapsedTime}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1">
                <img
                  src="/static/bento/bento-discord-futon.svg"
                  alt="No Status Image"
                  width={64}
                  height={64}
                  className="h-full w-fit rounded-lg"
                />
                <div className="text-[10px] text-muted-foreground">
                  No status!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 z-[1] m-3 flex size-14 items-center justify-center rounded-full bg-primary">
        <FaDiscord className="size-10 text-background" />
      </div>
    </div>
  )
}

export default DiscordPresence
