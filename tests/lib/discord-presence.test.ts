import { describe, expect, test } from "bun:test"
import {
  discordAssetUrl,
  formatDiscordCompleted,
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
      last_activity: null,
      ended_at_ms: null,
      duration_ms: null,
    })
    expect(parseDiscordStreamEvent('{"event_type":"keepalive"}')).toEqual({
      event_type: "keepalive",
    })
  })

  test("parses the server's record of the activity that just ended", () => {
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"online","timestamp_ms":1785564939159,"last_activity":{"name":"osu!","details":null,"state":null,"application_id":"1402418239342120960","start_ms":1785382211515,"assets":{"large_image":"https://cdn.discordapp.com/app-icons/1402418239342120960/ea86f6c52576847a7cb81f1c1faa18a3.png","large_text":"osu!"}},"ended_at_ms":1785382224148,"duration_ms":12633}',
    )

    expect(event?.event_type).toBe("no_activity")
    if (event?.event_type !== "no_activity") return
    expect(event.last_activity?.name).toBe("osu!")
    expect(event.ended_at_ms).toBe(1_785_382_224_148)
    expect(event.duration_ms).toBe(12_633)
  })

  test("rejects a malformed or negative ended-activity record", () => {
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"no_activity","status":"online","timestamp_ms":1,"last_activity":{"name":42,"assets":null}}',
      ),
    ).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"no_activity","status":"online","timestamp_ms":1,"duration_ms":-5}',
      ),
    ).toBeNull()
    expect(
      parseDiscordStreamEvent(
        '{"event_type":"no_activity","status":"online","timestamp_ms":1,"ended_at_ms":"yesterday"}',
      ),
    ).toBeNull()
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

describe("formatDiscordCompleted", () => {
  const HOUR = 3_600_000
  const now = 100 * 24 * HOUR

  test("pairs the recorded duration with how long ago it ended", () => {
    expect(formatDiscordCompleted(12_633, now - 50 * HOUR, now)).toBe(
      "for 00:00:12 · 2d ago",
    )
  })

  test("scales the relative time from seconds to days", () => {
    expect(formatDiscordCompleted(null, now - 30_000, now)).toBe("just now")
    expect(formatDiscordCompleted(null, now - 5 * 60_000, now)).toBe("5m ago")
    expect(formatDiscordCompleted(null, now - 3 * HOUR, now)).toBe("3h ago")
    expect(formatDiscordCompleted(null, now - 48 * HOUR, now)).toBe("2d ago")
  })

  test("clamps end times the server reports in the future", () => {
    expect(formatDiscordCompleted(null, now + HOUR, now)).toBe("just now")
  })

  test("omits the line when the server recorded neither field", () => {
    expect(formatDiscordCompleted(null, null, now)).toBeNull()
  })

  test("stands alone on the duration when no end time was recorded", () => {
    expect(formatDiscordCompleted(3_661_000, null, now)).toBe("for 01:01:01")
  })
})

describe("nextDiscordPresenceState", () => {
  test("adopts the server's ended-activity record over local timing", () => {
    const activityEvent = parseDiscordStreamEvent(
      '{"event_type":"current_state","status":"online","timestamp_ms":1,"activity":{"name":"Genshin Impact","start_ms":1000,"assets":null}}',
    )
    const noActivityEvent = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"offline","timestamp_ms":9999999,"last_activity":{"name":"Genshin Impact","start_ms":1000,"assets":null},"ended_at_ms":3662000,"duration_ms":3661000}',
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
      ended_at_ms: null,
    })
    expect(inactive).toEqual({
      activity: noActivityEvent.last_activity,
      status: "offline",
      is_active: false,
      duration_ms: 3_661_000,
      ended_at_ms: 3_662_000,
    })
    expect(nextDiscordPresenceState(inactive, noActivityEvent)).toBe(inactive)
  })

  test("reports the last activity to a visitor who never saw it start", () => {
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"online","timestamp_ms":9999999,"last_activity":{"name":"osu!","start_ms":1000,"assets":null},"ended_at_ms":13633,"duration_ms":12633}',
    )

    expect(event?.event_type).toBe("no_activity")
    if (event?.event_type !== "no_activity") return

    expect(nextDiscordPresenceState(null, event)).toEqual({
      activity: event.last_activity,
      status: "online",
      is_active: false,
      duration_ms: 12_633,
      ended_at_ms: 13_633,
    })
  })

  test("retains the running activity when the server records no history", () => {
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
      ended_at_ms: null,
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
      ended_at_ms: null,
    })
  })

  test("ignores keepalives without replacing the current state", () => {
    const event = parseDiscordStreamEvent('{"event_type":"keepalive"}')
    const current = {
      activity: null,
      status: "online" as const,
      is_active: false,
      duration_ms: null,
      ended_at_ms: null,
    }

    expect(event).not.toBeNull()
    if (!event) return

    expect(nextDiscordPresenceState(current, event)).toBe(current)
  })

  test("keeps a completed record across later status-only updates", () => {
    const current = {
      activity: {
        name: "Zed",
        start_ms: 1_000,
        assets: null,
      },
      status: "online" as const,
      is_active: false,
      duration_ms: 3_661_000,
      ended_at_ms: 3_662_000,
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

  test("reuses the current state when the server repeats a record", () => {
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"online","timestamp_ms":1,"last_activity":{"name":"osu!","start_ms":1000,"assets":null},"ended_at_ms":13633,"duration_ms":12633}',
    )
    const repeat = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"online","timestamp_ms":600000,"last_activity":{"name":"osu!","start_ms":1000,"assets":null},"ended_at_ms":13633,"duration_ms":12633}',
    )

    expect(event).not.toBeNull()
    expect(repeat).not.toBeNull()
    if (!event || !repeat) return

    const state = nextDiscordPresenceState(null, event)
    expect(nextDiscordPresenceState(state, repeat)).toBe(state)
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
          ended_at_ms: 3_662_000,
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
      ended_at_ms: 3_662_000,
    })
  })

  test("replaces a stale cache with the server's record on reconnect", () => {
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
        duration_pending: true,
      },
    ])
    const event = parseDiscordStreamEvent(
      '{"event_type":"no_activity","status":"idle","timestamp_ms":9999999,"last_activity":{"name":"osu!","start_ms":1000,"assets":null},"ended_at_ms":13633,"duration_ms":12633}',
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
      ended_at_ms: null,
    })
    expect(event?.event_type).toBe("no_activity")
    if (event?.event_type !== "no_activity") return
    if (!cached) return

    expect(nextDiscordPresenceState(cached, event)).toEqual({
      activity: event.last_activity,
      status: "idle",
      is_active: false,
      duration_ms: 12_633,
      ended_at_ms: 13_633,
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
