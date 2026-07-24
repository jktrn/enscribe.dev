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
  duration_pending: boolean
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
      isDiscordStatus(value.status)
    ) {
      return {
        event_type: "no_activity",
        timestamp_ms: value.timestamp_ms,
        status: value.status,
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

export const nextDiscordPresenceState = (
  current: DiscordPresenceState | null,
  event: DiscordStreamEvent,
): DiscordPresenceState | null => {
  if (event.event_type === "keepalive") return current

  if (event.event_type === "no_activity") {
    if (
      current &&
      !current.is_active &&
      !current.duration_pending &&
      current.status === event.status
    )
      return current

    const durationMs =
      (current?.is_active || current?.duration_pending) &&
      current.activity?.start_ms != null
        ? Math.max(event.timestamp_ms - current.activity.start_ms, 0)
        : (current?.duration_ms ?? null)

    return {
      activity: current?.activity ?? null,
      status: event.status,
      is_active: false,
      duration_ms: durationMs,
      duration_pending: false,
    }
  }

  return {
    activity: event.activity,
    status: event.status,
    is_active: true,
    duration_ms: null,
    duration_pending: true,
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
      (candidate.is_active !== undefined &&
        typeof candidate.is_active !== "boolean") ||
      (candidate.duration_ms !== undefined &&
        candidate.duration_ms !== null &&
        (!isFiniteNumber(candidate.duration_ms) ||
          candidate.duration_ms < 0)) ||
      (candidate.duration_pending !== undefined &&
        typeof candidate.duration_pending !== "boolean")
    ) {
      continue
    }

    const durationMs =
      typeof candidate.duration_ms === "number" ? candidate.duration_ms : null
    states.push({
      activity: candidate.activity,
      status: candidate.status,
      is_active: false,
      duration_ms: durationMs,
      duration_pending:
        candidate.activity !== null &&
        candidate.activity.start_ms != null &&
        durationMs === null &&
        (candidate.duration_pending === true || candidate.is_active === true),
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
