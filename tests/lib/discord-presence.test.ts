import { describe, expect, test } from "bun:test"
import {
  discordAssetUrl,
  formatDiscordDuration,
  formatDiscordElapsed,
  nextDiscordPresenceState,
  parseDiscordStreamEvent,
  selectCachedDiscordPresence,
} from "@/lib/discord-presence"

describe("parseDiscordStreamEvent", () => {
  test("parses activity state events", () => {
    const iconUrl =
      "https://cdn.discordapp.com/app-icons/762434991303950386/eb0e25b739e4fa38c1671a3d1edcd1e0.png"
    const event = parseDiscordStreamEvent(
      JSON.stringify({
        event_type: "current_state",
        timestamp_ms: 1_754_000_000_000,
        status: "online",
        activity: {
          name: "Genshin Impact",
          details: null,
          state: null,
          application_id: "762434991303950386",
          start_ms: 1_754_000_000_000,
          assets: {
            large_image: iconUrl,
            large_text: "Genshin Impact",
          },
        },
      }),
    )

    expect(event?.event_type).toBe("current_state")
    if (event?.event_type !== "current_state") return
    expect(event.status).toBe("online")
    expect(event.activity.name).toBe("Genshin Impact")
    expect(event.activity.start_ms).toBe(1_754_000_000_000)
    expect(event.activity.assets?.large_image).toBe(iconUrl)
  })

  test("parses non-activity events", () => {
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"no_activity","status":"idle","timestamp_ms":1754000000000}',
      ),
    ).toEqual({
      event_type: "no_activity",
      status: "idle",
      timestamp_ms: 1_754_000_000_000,
    })
    expect(parseDiscordStreamEvent('{"event_type":"keepalive"}')).toEqual({
      event_type: "keepalive",
    })
  })

  test("accepts nullable status and activity assets", () => {
    const event = parseDiscordStreamEvent(
      '{"event_type":"activity_update","status":null,"timestamp_ms":1,"activity":{"name":"Unknown Game","details":null,"state":null,"application_id":null,"assets":null}}',
    )

    expect(event).toEqual({
      event_type: "activity_update",
      status: null,
      timestamp_ms: 1,
      activity: {
        name: "Unknown Game",
        details: null,
        state: null,
        application_id: null,
        assets: null,
      },
    })
  })

  test("rejects malformed and unsupported messages", () => {
    expect(parseDiscordStreamEvent("not json")).toBeNull()
    expect(parseDiscordStreamEvent('{"event_type":"something_new"}')).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"activity_update","status":"online","timestamp_ms":1,"activity":null}',
      ),
    ).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"activity_update","status":"online","timestamp_ms":1,"activity":{"name":"Code","assets":[]}}',
      ),
    ).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"activity_update","status":"online","timestamp_ms":1,"activity":{"name":"Code","start_ms":"yesterday","assets":null}}',
      ),
    ).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"no_activity","status":"invisible","timestamp_ms":1}',
      ),
    ).toBeNull()
  })
})

describe("formatDiscordElapsed", () => {
  test("formats elapsed activity time and clamps future starts", () => {
    expect(formatDiscordElapsed(1_000, 3_662_000)).toBe("01:01:01 elapsed")
    expect(formatDiscordElapsed(2_000, 1_000)).toBe("00:00:00 elapsed")
  })

  test("formats a completed activity duration without a verb", () => {
    expect(formatDiscordDuration(3_661_000)).toBe("01:01:01")
  })
})

describe("nextDiscordPresenceState", () => {
  test("keeps the last activity when Discord reports no activity", () => {
    const activityEvent = parseDiscordStreamEvent(
      '{"event_type":"current_state","status":"online","timestamp_ms":1,"activity":{"name":"Genshin Impact","start_ms":1,"assets":null}}',
    )
    const noActivityEvent = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"offline","timestamp_ms":2}',
    )

    expect(activityEvent?.event_type).toBe("current_state")
    expect(noActivityEvent?.event_type).toBe("no_activity")
    if (
      activityEvent?.event_type !== "current_state" ||
      noActivityEvent?.event_type !== "no_activity"
    )
      return

    const active = nextDiscordPresenceState(null, activityEvent)
    const inactive = nextDiscordPresenceState(active, noActivityEvent)

    expect(active).toEqual({
      activity: activityEvent.activity,
      status: "online",
      is_active: true,
      duration_ms: null,
      duration_pending: true,
    })
    expect(inactive).toEqual({
      activity: activityEvent.activity,
      status: "offline",
      is_active: false,
      duration_ms: 1,
      duration_pending: false,
    })
    expect(nextDiscordPresenceState(inactive, noActivityEvent)).toBe(inactive)
  })

  test("marks retained activity inactive when status is unchanged", () => {
    const activityEvent = parseDiscordStreamEvent(
      '{"event_type":"current_state","status":"online","timestamp_ms":1,"activity":{"name":"Zed","assets":null}}',
    )
    const noActivityEvent = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"online","timestamp_ms":2}',
    )

    expect(activityEvent?.event_type).toBe("current_state")
    expect(noActivityEvent?.event_type).toBe("no_activity")
    if (
      activityEvent?.event_type !== "current_state" ||
      noActivityEvent?.event_type !== "no_activity"
    )
      return

    const active = nextDiscordPresenceState(null, activityEvent)
    expect(nextDiscordPresenceState(active, noActivityEvent)).toEqual({
      activity: activityEvent.activity,
      status: "online",
      is_active: false,
      duration_ms: null,
      duration_pending: false,
    })
  })

  test("shows an empty inactive state until an activity has been seen", () => {
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"idle","timestamp_ms":1}',
    )

    expect(event).not.toBeNull()
    if (!event) return

    expect(nextDiscordPresenceState(null, event)).toEqual({
      activity: null,
      status: "idle",
      is_active: false,
      duration_ms: null,
      duration_pending: false,
    })
  })

  test("ignores keepalives without replacing the current state", () => {
    const event = parseDiscordStreamEvent('{"event_type":"keepalive"}')
    const current = {
      activity: null,
      status: "online" as const,
      is_active: false,
      duration_ms: null,
      duration_pending: false,
    }

    expect(event).not.toBeNull()
    if (!event) return

    expect(nextDiscordPresenceState(current, event)).toBe(current)
  })

  test("keeps a completed duration across later idle status updates", () => {
    const current = {
      activity: {
        name: "Zed",
        start_ms: 1_000,
        assets: null,
      },
      status: "online" as const,
      is_active: false,
      duration_ms: 3_661_000,
      duration_pending: false,
    }
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"idle","timestamp_ms":9999999}',
    )

    expect(event?.event_type).toBe("no_activity")
    if (event?.event_type !== "no_activity") return

    expect(nextDiscordPresenceState(current, event)).toEqual({
      ...current,
      status: "idle",
    })
  })
})

describe("selectCachedDiscordPresence", () => {
  test("recovers an activity from a legacy cache when the current cache is empty", () => {
    expect(
      selectCachedDiscordPresence([
        {
          activity: null,
          status: "online",
          is_active: false,
          duration_ms: null,
          duration_pending: false,
        },
        {
          activity: {
            name: "Zed",
            details: "In enscribe.dev-new",
            state: "Working on build...",
            assets: null,
          },
          status: "online",
          is_active: true,
          duration_ms: 3_661_000,
          duration_pending: false,
        },
      ]),
    ).toEqual({
      activity: {
        name: "Zed",
        details: "In enscribe.dev-new",
        state: "Working on build...",
        assets: null,
      },
      status: "online",
      is_active: false,
      duration_ms: 3_661_000,
      duration_pending: false,
    })
  })

  test("finalizes an activity that ended while the page was closed", () => {
    const cached = selectCachedDiscordPresence([
      {
        activity: {
          name: "Zed",
          start_ms: 1_000,
          assets: null,
        },
        status: "online",
        is_active: true,
        duration_ms: null,
      },
    ])
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"idle","timestamp_ms":3662000}',
    )

    expect(cached).toEqual({
      activity: {
        name: "Zed",
        start_ms: 1_000,
        assets: null,
      },
      status: "online",
      is_active: false,
      duration_ms: null,
      duration_pending: true,
    })
    expect(event?.event_type).toBe("no_activity")
    if (event?.event_type !== "no_activity") return
    if (!cached) return

    expect(nextDiscordPresenceState(cached, event)).toEqual({
      activity: cached.activity,
      status: "idle",
      is_active: false,
      duration_ms: 3_661_000,
      duration_pending: false,
    })
  })

  test("ignores invalid cached values", () => {
    expect(
      selectCachedDiscordPresence([
        "not a presence",
        { activity: { name: 42 }, status: "online" },
      ]),
    ).toBeNull()
  })
})

describe("discordAssetUrl", () => {
  test("keeps ready-to-use Discord HTTPS assets unchanged", () => {
    const iconUrl =
      "https://cdn.discordapp.com/app-icons/762434991303950386/eb0e25b739e4fa38c1671a3d1edcd1e0.png"
    expect(discordAssetUrl(iconUrl)).toBe(iconUrl)
  })

  test("rejects missing, insecure, and legacy asset references", () => {
    expect(discordAssetUrl(undefined)).toBeNull()
    expect(discordAssetUrl(null)).toBeNull()
    expect(discordAssetUrl("http://cdn.discordapp.com/image.png")).toBeNull()
    expect(discordAssetUrl("565945770067623946")).toBeNull()
    expect(discordAssetUrl("mp:external/example/image.png")).toBeNull()
  })
})
