import { useMemo, useState, useEffect, useCallback, memo } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { useLanyard } from 'react-use-lanyard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getElapsedTime } from '@/lib/utils'
import AvatarComponent from '@/components/ui/avatar'

const DISCORD_USER_ID = '747519888347627550'

interface Activity {
  type: number
  name?: string
  details?: string
  state?: string
  application_id?: string
  assets?: {
    large_image?: string
    small_image?: string
  }
  timestamps?: {
    start?: number
  }
}

interface LanyardData {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  activities?: Activity[]
}

const STATUS_CONFIGS = {
  online: {
    bgClass: 'bg-primary',
    hasIndicator: false,
  },
  idle: {
    bgClass: 'bg-primary',
    hasIndicator: true,
    indicator: <div className="bg-background size-[10px] rounded-full" />,
  },
  dnd: {
    bgClass: 'bg-destructive',
    hasIndicator: true,
    indicator: <div className="bg-background h-[4px] w-[11px] rounded-full" />,
  },
  offline: {
    bgClass: 'bg-muted-foreground',
    hasIndicator: true,
    indicator: <div className="bg-background size-2 rounded-full" />,
  },
} as const

const StatusIndicator = memo<{ status: LanyardData['discord_status'] }>(
  ({ status }) => {
    const config = STATUS_CONFIGS[status]

    return (
      <div
        className={cn(
          'ring-muted absolute right-1 bottom-1 size-4 rounded-full ring-6',
          config.bgClass,
          config.hasIndicator && 'flex items-center justify-center',
        )}
      >
        {config.hasIndicator && config.indicator}
      </div>
    )
  },
)

const DecorativeBadges = memo(() => {
  const badgeStyles = useMemo(
    () => [
      'grayscale size-3 rounded-full bg-purple-200/75 sepia-50',
      'grayscale size-3 bg-violet-200/75 sepia-50 rounded-xs',
      'grayscale size-3 rounded-xs bg-emerald-200/75 sepia-50',
      'grayscale size-3 bg-fuchsia-200/75 sepia-50',
      'grayscale size-3 rounded-full bg-teal-200/75 sepia-50',
      'grayscale size-3 rounded-full bg-transparent ring-2 ring-sky-200/75 sepia-50 ring-inset',
    ],
    [],
  )

  const clipPaths = useMemo(
    () => [
      undefined,
      'polygon(50% 100%, 100% 50%, 100% 0%, 0% 0%, 0% 50%)',
      undefined,
      'polygon(50% 0%, 85% 0%, 100% 35%, 85% 55%, 50% 100%, 15% 55%, 0% 35%, 15% 0%)',
      undefined,
      undefined,
    ],
    [],
  )

  return (
    <div className="bg-border/50 flex items-center gap-1.5 px-2">
      {badgeStyles.map((style, index) => (
        <div
          key={index}
          className={style}
          style={clipPaths[index] ? { clipPath: clipPaths[index] } : undefined}
        />
      ))}
    </div>
  )
})

const UserInfo = memo(() => (
  <div className="bg-border/50 flex flex-col gap-y-1 p-3">
    <span className="text-base leading-none">enscribe</span>
    <span className="text-muted-foreground text-xs leading-none">
      @enscribe
    </span>
  </div>
))

const AvatarSection = memo<{
  statusIndicator: React.ReactNode
}>(({ statusIndicator }) => (
  <div className="flex justify-between gap-x-1">
    <div className="relative">
      <AvatarComponent
        src="/static/bento/avatar.jpg"
        alt="Avatar"
        fallback="e"
        className="-mt-12 aspect-square grayscale sepia-50 size-16 rounded-full sm:-mt-[4.5rem] sm:size-24"
      />
      <div
        className="absolute inset-0 -mt-12 aspect-square size-16 rounded-full bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-200 group-hover/discord:opacity-100 sm:-mt-[4.5rem] sm:size-24 sm:bg-[url('/static/bento/avatar-foreground.png')]"
        aria-hidden="true"
      />
      {statusIndicator}
    </div>
    <DecorativeBadges />
  </div>
))

const DiscordIcon = memo(() => (
  <div className="bg-primary absolute top-0 right-0 m-3 flex size-14 items-center justify-center rounded-full">
    <FaDiscord className="text-background size-10" />
  </div>
))

const DiscordLayout = memo<{
  statusIndicator: React.ReactNode
  activityContent: React.ReactNode
}>(({ statusIndicator, activityContent }) => (
  <div
    data-trigger
    className="group/discord relative size-full overflow-hidden"
  >
    <p className="text-foreground/80 bg-muted absolute top-4 left-30 hidden border p-2 text-xs opacity-0 transition-opacity duration-200 group-hover/discord:opacity-100 sm:block">
      Feel free
      <br />
      to add me!
    </p>
    <div className="grid size-full grid-rows-4">
      <div className="bg-border/25 bg-[url('/static/bento/discord-banner.png')] bg-cover bg-center bg-no-repeat" />
      <div className="bg-muted row-span-3 flex flex-col gap-3 p-3">
        <AvatarSection statusIndicator={statusIndicator} />
        <UserInfo />
        <div className="bg-border/50 flex-1 p-3">{activityContent}</div>
      </div>
    </div>
    <DiscordIcon />
  </div>
))

const ActivityDisplay = memo<{
  activity: Activity | null
  elapsedTime: string
}>(({ activity, elapsedTime }) => {
  const activityImageUrl = useMemo(() => {
    if (!activity?.assets?.large_image || !activity.application_id) {
      return '/static/bento/bento-discord-futon.svg'
    }
    return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`
  }, [activity?.assets?.large_image, activity?.application_id])

  const smallImageUrl = useMemo(() => {
    if (!activity?.assets?.small_image || !activity.application_id) return null
    return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.small_image}.png`
  }, [activity?.assets?.small_image, activity?.application_id])

  const displayActivity = activity || {
    name: 'No status',
    details: "I'm probably sleeping...",
    state: 'Enjoy your stay!',
  }

  const displayElapsedTime = elapsedTime || '∞:00 elapsed'

  return (
    <div className="flex size-full items-center gap-x-2 sm:gap-x-3">
      <div className="relative aspect-square h-full max-h-12 shrink-0 sm:max-h-16">
        <div
          style={{ backgroundImage: `url('${activityImageUrl}')` }}
          className="absolute inset-0 bg-contain bg-center bg-no-repeat grayscale sepia-50"
        />
        {smallImageUrl && (
          <div className="absolute -right-1 -bottom-1 overflow-hidden rounded-full border-2 border-[#26231f] sm:-right-2 sm:-bottom-2 sm:border-4">
            <img
              src={smallImageUrl}
              alt="Application Icon"
              width={16}
              height={16}
              className="grayscale sepia-50 sm:h-6 sm:w-6"
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-y-1 py-1">
        {displayActivity.name && (
          <div className="mb-0.5 line-clamp-1 text-xs leading-none">
            {displayActivity.name}
          </div>
        )}
        {displayActivity.details && (
          <div className="text-muted-foreground line-clamp-2 text-[11px] leading-none">
            {displayActivity.details}
          </div>
        )}
        {displayActivity.state && (
          <div className="text-muted-foreground line-clamp-1 text-[11px] leading-none">
            {displayActivity.state}
          </div>
        )}
        {displayElapsedTime && (
          <div className="text-muted-foreground text-[11px] leading-none">
            {displayElapsedTime}
          </div>
        )}
      </div>
    </div>
  )
})

const LoadingSkeleton = memo(() => (
  <DiscordLayout
    statusIndicator={
      <Skeleton className="ring-muted absolute right-1 bottom-1 size-4 rounded-full ring-6" />
    }
    activityContent={<Skeleton className="h-full w-full" />}
  />
))

const DiscordPresence = () => {
  const {
    data: lanyard,
    isLoading,
    error,
  } = useLanyard({
    userId: DISCORD_USER_ID,
  })

  const mainActivity = useMemo(() => {
    if (!lanyard?.data?.activities) return null
    return (
      lanyard.data.activities.find(
        (activity) => activity.type === 0 && !!activity.assets,
      ) || null
    )
  }, [lanyard?.data?.activities])

  const [elapsedTime, setElapsedTime] = useState('')

  const updateElapsedTime = useCallback(() => {
    if (mainActivity?.timestamps?.start) {
      setElapsedTime(getElapsedTime(mainActivity.timestamps.start))
    }
  }, [mainActivity?.timestamps?.start])

  useEffect(() => {
    if (!mainActivity?.timestamps?.start) {
      setElapsedTime('')
      return
    }

    updateElapsedTime()
    const intervalId = setInterval(updateElapsedTime, 1000)
    return () => clearInterval(intervalId)
  }, [mainActivity?.timestamps?.start, updateElapsedTime])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !lanyard?.data) {
    return null
  }

  const { discord_status } = lanyard.data

  return (
    <DiscordLayout
      statusIndicator={<StatusIndicator status={discord_status} />}
      activityContent={
        <ActivityDisplay activity={mainActivity} elapsedTime={elapsedTime} />
      }
    />
  )
}

export default memo(DiscordPresence)
