export interface DiscordActivityAssets {
  large_image?: string | null
  large_text?: string | null
  small_image?: string | null
  small_text?: string | null
}

export interface DiscordActivity {
  name: string
  details?: string | null
  state?: string | null
  application_id?: string | null
  start_ms?: number | null
  assets: DiscordActivityAssets | null
}

export type DiscordStatus = "online" | "idle" | "dnd" | "offline" | null

interface ActivityEvent {
  event_type: "current_state" | "activity_update"
  timestamp_ms: number
  activity: DiscordActivity
  status: DiscordStatus
}

interface NoActivityEvent {
  event_type: "no_activity"
  timestamp_ms: number
  status: DiscordStatus
  last_activity: DiscordActivity | null
  ended_at_ms: number | null
  duration_ms: number | null
}

interface KeepaliveEvent {
  event_type: "keepalive"
}

export type DiscordStreamEvent =
  | ActivityEvent
  | NoActivityEvent
  | KeepaliveEvent

export interface DiscordPresenceState {
  activity: DiscordActivity | null
  status: DiscordStatus
  is_active: boolean
  duration_ms: number | null
  ended_at_ms: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isOptionalString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string"

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isOptionalFiniteNumber = (
  value: unknown,
): value is number | null | undefined =>
  value === undefined || value === null || isFiniteNumber(value)

const isOptionalDuration = (
  value: unknown,
): value is number | null | undefined =>
  isOptionalFiniteNumber(value) && (typeof value !== "number" || value >= 0)

const isDiscordStatus = (value: unknown): value is DiscordStatus =>
  value === null ||
  value === "online" ||
  value === "idle" ||
  value === "dnd" ||
  value === "offline"

const isActivity = (value: unknown): value is DiscordActivity => {
  if (!isRecord(value)) return false

  const { assets } = value
  return (
    typeof value.name === "string" &&
    isOptionalString(value.details) &&
    isOptionalString(value.state) &&
    isOptionalString(value.application_id) &&
    isOptionalFiniteNumber(value.start_ms) &&
    (assets === null ||
      (isRecord(assets) &&
        isOptionalString(assets.large_image) &&
        isOptionalString(assets.large_text) &&
        isOptionalString(assets.small_image) &&
        isOptionalString(assets.small_text)))
  )
}

export const parseDiscordStreamEvent = (
  serialized: string,
): DiscordStreamEvent | null => {
  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value) || typeof value.event_type !== "string") return null

    if (value.event_type === "keepalive") return { event_type: "keepalive" }

    if (
      value.event_type === "no_activity" &&
      isFiniteNumber(value.timestamp_ms) &&
      isDiscordStatus(value.status) &&
      (value.last_activity == null || isActivity(value.last_activity)) &&
      isOptionalFiniteNumber(value.ended_at_ms) &&
      isOptionalDuration(value.duration_ms)
    ) {
      return {
        event_type: "no_activity",
        timestamp_ms: value.timestamp_ms,
        status: value.status,
        last_activity: value.last_activity ?? null,
        ended_at_ms: value.ended_at_ms ?? null,
        duration_ms: value.duration_ms ?? null,
      }
    }

    if (
      (value.event_type === "current_state" ||
        value.event_type === "activity_update") &&
      isFiniteNumber(value.timestamp_ms) &&
      isDiscordStatus(value.status) &&
      isActivity(value.activity)
    ) {
      return {
        event_type: value.event_type,
        timestamp_ms: value.timestamp_ms,
        activity: value.activity,
        status: value.status,
      }
    }

    return null
  } catch {
    return null
  }
}

const isSamePresence = (
  current: DiscordPresenceState | null,
  next: DiscordPresenceState,
): boolean =>
  current !== null &&
  current.status === next.status &&
  current.is_active === next.is_active &&
  current.duration_ms === next.duration_ms &&
  current.ended_at_ms === next.ended_at_ms &&
  JSON.stringify(current.activity) === JSON.stringify(next.activity)

export const nextDiscordPresenceState = (
  current: DiscordPresenceState | null,
  event: DiscordStreamEvent,
): DiscordPresenceState | null => {
  if (event.event_type === "keepalive") return current

  if (event.event_type === "no_activity") {
    const next: DiscordPresenceState = event.last_activity
      ? {
          activity: event.last_activity,
          status: event.status,
          is_active: false,
          duration_ms: event.duration_ms,
          ended_at_ms: event.ended_at_ms,
        }
      : {
          activity: current?.activity ?? null,
          status: event.status,
          is_active: false,
          duration_ms: current?.is_active
            ? null
            : (current?.duration_ms ?? null),
          ended_at_ms: current?.is_active
            ? null
            : (current?.ended_at_ms ?? null),
        }

    return isSamePresence(current, next) ? current : next
  }

  return {
    activity: event.activity,
    status: event.status,
    is_active: true,
    duration_ms: null,
    ended_at_ms: null,
  }
}

export const selectCachedDiscordPresence = (
  candidates: readonly unknown[],
): DiscordPresenceState | null => {
  const states: DiscordPresenceState[] = []

  for (const candidate of candidates) {
    if (
      !isRecord(candidate) ||
      !(candidate.activity === null || isActivity(candidate.activity)) ||
      !isDiscordStatus(candidate.status) ||
      !isOptionalDuration(candidate.duration_ms) ||
      !isOptionalFiniteNumber(candidate.ended_at_ms)
    ) {
      continue
    }

    states.push({
      activity: candidate.activity,
      status: candidate.status,
      is_active: false,
      duration_ms: candidate.duration_ms ?? null,
      ended_at_ms: candidate.ended_at_ms ?? null,
    })
  }

  return states.find((state) => state.activity !== null) ?? states[0] ?? null
}

export const formatDiscordElapsed = (
  startMs: number,
  nowMs = Date.now(),
): string => `${formatDiscordDuration(nowMs - startMs)} elapsed`

export const formatDiscordDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(Math.max(durationMs, 0) / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, "0")
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const formatDiscordAgo = (endedAtMs: number, nowMs: number): string => {
  const minutes = Math.floor((nowMs - endedAtMs) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export const formatDiscordCompleted = (
  durationMs: number | null,
  endedAtMs: number | null,
  nowMs = Date.now(),
): string | null => {
  const parts: string[] = []
  if (durationMs != null) parts.push(`for ${formatDiscordDuration(durationMs)}`)
  if (endedAtMs != null) parts.push(formatDiscordAgo(endedAtMs, nowMs))
  return parts.length > 0 ? parts.join(" · ") : null
}

export const discordAssetUrl = (
  asset: string | null | undefined,
): string | null => {
  if (!asset) return null
  try {
    return new URL(asset).protocol === "https:" ? asset : null
  } catch {
    return null
  }
}
