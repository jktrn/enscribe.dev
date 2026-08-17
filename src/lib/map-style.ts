import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl"

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

/**
 * With no `glyphs` URL the style's text-font is read as a cascading list of
 * *local* font names, which is what lets the site face be used at all. Only the
 * first entry decides weight and style; the rest are per-codepoint fallbacks.
 *
 * ORDER IS LOAD-BEARING: proportional faces must come before any CJK face. CJK
 * fonts also contain Cyrillic, Greek and Latin, but draw them full-width (one
 * em per glyph), so a CJK font reached early renders "Москва" at double width
 * with the letters visibly strewn apart. Ideographs are full-width by design
 * and still resolve correctly from the tail of the list.
 */
export const MAP_LABEL_FONTS = [
  // Latin: the site face.
  "MD Lorien",
  // Proportional coverage for Cyrillic, Greek, Georgian, Vietnamese, Thai.
  "Noto Sans",
  "Helvetica Neue",
  "Arial",
  "Segoe UI",
  // CJK, after everything proportional. macOS, Windows, then Noto.
  "Hiragino Sans",
  "Yu Gothic",
  "Meiryo",
  "Noto Sans JP",
  "Microsoft JhengHei",
  "Noto Sans TC",
  // Broad backstop for anything the above miss.
  "Arial Unicode MS",
]

export type LoadMapStyleOptions = {
  /** Keep only these layers. Safe only within the zoom window they were picked for. */
  keepLayerIds?: ReadonlySet<string>
  /** Repaint without cross-fading, for maps that jump rather than animate. */
  instantTransitions?: boolean
}

type PaintOverrides = Partial<
  Record<
    | "background-color"
    | "fill-color"
    | "fill-outline-color"
    | "line-color"
    | "text-color"
    | "text-halo-color",
    string
  >
>

/**
 * Positron labels places as "Latin\nNative". Drop the native line, and resolve
 * the surviving line in one language rather than per feature.
 *
 * Dropping the native line is not a stylistic preference: without a glyphs URL,
 * MapLibre rasterizes one codepoint at a time with no text shaping, and complex
 * scripts need shaping. Khmer, Burmese, Sinhala and Devanagari combining marks
 * report a non-zero advance in isolation when it should be zero, so clusters
 * render 1.2x-2x too wide with the marks strewn beside their base rather than
 * attached — Phnom Penh measures 1.78x, Yangon 1.6x. Thai advances are correct
 * but its marks stack vertically, and rendered in isolation they collide.
 *
 * `name:en` leads because `name:latin` is the LOCAL name transliterated, not
 * the English one, so reading it first makes the language a property of the
 * feature instead of the map: Hudson Bay's canonical OSM node carries
 * `name:latin` "Hudson Bay" while the forty duplicate Québec nodes for the same
 * water carry "Baie d'Hudson", and both used to render side by side.
 *
 * `name_en` is deliberately absent: OpenMapTiles defines it as `name:en` OR
 * `name`, so it silently reintroduces the unshapeable native string. `name:en`
 * only exists when actually tagged, which is what makes the chain honest.
 *
 * Only touches expressions that reference name:nonlatin, so the `ref`-based
 * highway shields are left alone.
 */
type TextField = NonNullable<SymbolLayerSpecification["layout"]>["text-field"]

const LABEL_NAME_KEYS = ["name:en", "name:latin", "name"] as const

const singleLanguage = (textField: TextField): TextField => {
  if (!JSON.stringify(textField)?.includes("name:nonlatin")) return textField
  return [
    "coalesce",
    ...LABEL_NAME_KEYS.map((key) => ["get", key]),
  ] as TextField
}

/** Fetch Positron and swap its label font for the site's. */
export const loadMapStyle = async (options: LoadMapStyleOptions = {}) => {
  // Concurrent, not serial: the face is already preloaded in the document head,
  // but it has no business sitting in front of the style fetch either way.
  const [, response] = await Promise.all([
    document.fonts.load('16px "MD Lorien"'),
    fetch(MAP_STYLE_URL),
  ])
  if (!response.ok) {
    throw new Error(`Unable to load map style (${response.status})`)
  }

  const style = (await response.json()) as StyleSpecification
  // Deliberate: without this, text-font is resolved against a glyph server that
  // has never heard of "MD Lorien". Removing it is what enables local fonts.
  delete style.glyphs
  // Declared by Positron, referenced by zero layers.
  delete style.sources.ne2_shaded

  if (options.instantTransitions) {
    style.transition = { duration: 0, delay: 0 }
  }
  if (options.keepLayerIds) {
    const keep = options.keepLayerIds
    style.layers = style.layers.filter((layer) => keep.has(layer.id))
  }

  for (const layer of style.layers) {
    if (layer.type === "symbol" && "text-field" in (layer.layout ?? {})) {
      layer.layout ??= {}
      layer.layout["text-font"] = MAP_LABEL_FONTS
      layer.layout["text-field"] = singleLanguage(layer.layout["text-field"])
    }
  }

  return style
}

/**
 * Layers fed by `water_name`, the one OpenMapTiles layer whose OSM inputs are
 * duplicated badly enough to need collapsing. Settlement layers are keyed on a
 * single node per place, so they do not repeat this way.
 */
const WATER_LABEL_LAYERS = [
  "water_name_point_label",
  "water_name_line_label",
] as const

/** Source and layer this module owns for the labels it re-places itself. */
const DEDUPED_SOURCE = "water-name-deduped"
export const DEDUPED_WATER_LABEL_LAYER = "water_name_deduped_label"

/** The label a `water_name` feature resolves to, matching `singleLanguage`. */
const labelOf = (properties: Record<string, unknown>) =>
  LABEL_NAME_KEYS.map((key) => properties[key]).find(
    (value): value is string => typeof value === "string" && value.length > 0,
  )

/** How many `name*` tags a feature carries — a proxy for how well known it is. */
const translationCount = (properties: Record<string, unknown>) =>
  Object.keys(properties).filter((key) => key.startsWith("name")).length

type SourceFeature = ReturnType<MapLibreMap["querySourceFeatures"]>[number]

type LabelFeature = {
  type: "Feature"
  properties: { label: string }
  geometry: { type: "Point"; coordinates: [number, number] }
}

/** A point to hang the label on: the node itself, or a line's middle vertex. */
const anchorOf = (
  geometry: SourceFeature["geometry"],
): [number, number] | undefined => {
  if (geometry.type === "Point") return geometry.coordinates as [number, number]
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    const points = geometry.coordinates
    return points[Math.floor(points.length / 2)] as [number, number] | undefined
  }
  return undefined
}

/**
 * Render one label per water body instead of one per OSM feature.
 *
 * OSM maps large bodies as many independent features sharing a name — Hudson
 * Bay is 41 `natural=bay` nodes strung along the Québec coast plus a lakeline,
 * all resolving to "Hudson Bay", so Positron stamps the name 41 times. Nothing
 * in the style spec dedupes by text: collision only suppresses labels that
 * physically overlap, and these sit hundreds of pixels apart.
 *
 * Excluding the extras by feature id does not work either — `["id"]` resolves
 * to null in worker-side filters for plain vector-tile features, so an
 * id-keyed filter silently matches nothing. The duplicates are also property-
 * identical to each other, leaving no expression that can pick one out.
 *
 * So the collapse is done by name: every copy of a duplicated name is filtered
 * out of Positron's two layers, and this module re-places a single label for it
 * from its own GeoJSON source. Names that are not duplicated — the overwhelming
 * majority — never leave Positron's layers and keep its line placement.
 *
 * The survivor is the most-translated feature: translation count tracks
 * notability, and unlike "nearest the cluster centroid" it does not shift as
 * tiles stream in, so the label never hops between nodes mid-pan. Decisions
 * accumulate across passes for the same reason — a viewport holding only
 * duplicates picks one, and yields to the canonical feature once it loads.
 *
 * Trade-off: two genuinely distinct waters sharing a name collapse to one. That
 * is the right call at these zooms, where the duplicate-toponym case is common
 * and the homonym case is not.
 */
export const collapseDuplicateWaterLabels = (map: MapLibreMap) => {
  const baseFilters = new Map<string, FilterSpecification | undefined>()
  for (const id of WATER_LABEL_LAYERS) {
    if (map.getLayer(id)) baseFilters.set(id, map.getFilter(id) || undefined)
  }
  if (!baseFilters.size) return

  type Candidate = { rank: number; anchor: [number, number] }
  // label -> feature id -> what that feature offers as the label's home.
  const seen = new Map<string, Map<number, Candidate>>()

  map.addSource(DEDUPED_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  })
  // Above Positron's own water labels, which is where it was cut from.
  map.addLayer({
    id: DEDUPED_WATER_LABEL_LAYER,
    type: "symbol",
    source: DEDUPED_SOURCE,
    layout: {
      "text-field": ["get", "label"],
      "text-font": MAP_LABEL_FONTS,
      "text-letter-spacing": 0.2,
      "text-max-width": 5,
      "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 8, 14],
    },
    // Colours arrive from applyMapTheme; only the width is Positron's own.
    paint: { "text-halo-width": 1.5 },
  } as never)

  const update = () => {
    const features = map.querySourceFeatures("openmaptiles", {
      sourceLayer: "water_name",
    })

    let discovered = false
    for (const feature of features) {
      const id = feature.id
      const properties = feature.properties
      if (typeof id !== "number" || !properties) continue
      const label = labelOf(properties)
      const anchor = anchorOf(feature.geometry)
      if (!label || !anchor) continue

      const byId = seen.get(label) ?? new Map<number, Candidate>()
      if (byId.has(id)) continue
      byId.set(id, { rank: translationCount(properties), anchor })
      seen.set(label, byId)
      discovered = true
    }
    if (!discovered) return

    const collapsed: LabelFeature[] = []
    for (const [label, byId] of seen) {
      if (byId.size < 2) continue
      let winner: Candidate | undefined
      let winnerId = Number.POSITIVE_INFINITY
      for (const [id, candidate] of byId) {
        // Id breaks rank ties so the choice does not depend on load order.
        const better =
          !winner ||
          candidate.rank > winner.rank ||
          (candidate.rank === winner.rank && id < winnerId)
        if (better) {
          winner = candidate
          winnerId = id
        }
      }
      if (!winner) continue
      collapsed.push({
        type: "Feature",
        properties: { label },
        geometry: { type: "Point", coordinates: winner.anchor },
      })
    }
    if (!collapsed.length) return

    const names = collapsed.map((feature) => feature.properties.label)
    const key = ["coalesce", ...LABEL_NAME_KEYS.map((name) => ["get", name])]
    const exclude = ["!", ["in", key, ["literal", names]]]
    for (const [id, base] of baseFilters) {
      map.setFilter(id, (base ? ["all", base, exclude] : exclude) as never)
    }
    const source = map.getSource<GeoJSONSource>(DEDUPED_SOURCE)
    source?.setData({ type: "FeatureCollection", features: collapsed })
  }

  update()
  map.on("idle", update)
}

/** The zoom range TILE_LAYER_IDS is derived for. Cities must stay inside it. */
export const TILE_ZOOM_RANGE = { min: 7, max: 12 } as const

/**
 * Positron layers that can paint anywhere in TILE_ZOOM_RANGE, derived from the
 * live style's own minzoom/maxzoom rather than by eye. Most omitted layers
 * cannot draw in that range at all — buildings and taxiways start at z12,
 * railways at z13, street name labels at z15 — so dropping them costs no
 * fidelity while roughly halving the style handed to the worker.
 *
 * The two highway-shield layers are the exception: they DO draw here, and are
 * dropped on purpose. Freeway badges are the loudest thing on a cell this
 * small, and they compete with the score bubbles for the same attention.
 * /food keeps them, since it calls loadMapStyle() without an allowlist.
 *
 * The range is deliberately wider than the cities actually use, so retuning a
 * zoom does not silently delete map features. Move outside it and the DEV
 * warning in applyMapTheme will fire for anything unmapped.
 */
export const TILE_LAYER_IDS: ReadonlySet<string> = new Set([
  "background",
  "park",
  "water",
  "landcover_ice_shelf",
  "landcover_glacier",
  "landuse_residential",
  "landcover_wood",
  "waterway",
  "tunnel_motorway_casing",
  "tunnel_motorway_inner",
  "aeroway-runway-casing",
  "aeroway-area",
  "aeroway-runway",
  "road_area_pier",
  "road_pier",
  "highway_path",
  "highway_minor",
  "highway_major_casing",
  "highway_major_inner",
  "highway_major_subtle",
  "highway_motorway_casing",
  "highway_motorway_inner",
  "highway_motorway_bridge_casing",
  "highway_motorway_bridge_inner",
  "boundary_3",
  "boundary_2",
  "boundary_disputed",
  "waterway_line_label",
  "water_name_point_label",
  "water_name_line_label",
  "airport",
  "label_other",
  "label_village",
  "label_town",
  "label_state",
  "label_city",
  "label_city_capital",
  "label_country_3",
  "label_country_2",
  "label_country_1",
])

/**
 * MapLibre paint properties need literal colors, so CSS custom properties are
 * resolved through a probe element and flattened to rgba() via a 1x1 canvas.
 */
export const createColorResolver = () => {
  const probe = document.createElement("span")
  probe.hidden = true
  document.body.append(probe)

  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })

  const resolve = (value: string) => {
    probe.style.color = value
    const computed = getComputedStyle(probe).color
    if (!context) return computed
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = computed
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    return `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`
  }

  return { resolve, dispose: () => probe.remove() }
}

/** Index order is draw order: 0 draws first, 5 (best) draws on top. */
export const TONE_KEYS = [
  "none",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
] as const
export type ToneKey = (typeof TONE_KEYS)[number]

const TONE_VAR: Record<ToneKey, string> = {
  none: "var(--foreground-l7)",
  red: "var(--tone-red)",
  orange: "var(--tone-orange)",
  yellow: "var(--tone-yellow)",
  green: "var(--tone-green)",
  blue: "var(--tone-blue)",
}

const RATING_STOPS = [
  { maximum: 2, tone: "red" },
  { maximum: 4, tone: "orange" },
  { maximum: 6, tone: "yellow" },
  { maximum: 8, tone: "green" },
  { maximum: 10, tone: "blue" },
] as const satisfies readonly { maximum: number; tone: ToneKey }[]

const toneKeyForScore = (score: number | null): ToneKey => {
  if (score === null) return "none"
  return RATING_STOPS.find((stop) => score <= stop.maximum)?.tone ?? "blue"
}

/** CSS custom property for a score, for callers that style DOM nodes. */
export const toneForScore = (score: number | null) =>
  TONE_VAR[toneKeyForScore(score)]

/** Numeric tone bucket, for callers that feed a data-driven paint expression. */
export const toneIndexForScore = (score: number | null) =>
  TONE_KEYS.indexOf(toneKeyForScore(score))

/**
 * Rings mix toward the FOREGROUND, matching the markers on /food. Mixing toward
 * --background-l0 instead produces a lighter, desaturated halo that reads as a
 * glow rather than an outline, and picks up the basemap's warm cast.
 */

/**
 * A bubble's colours for a score, resolved to literal colours.
 *
 * Monochrome on purpose: the rest of the page carries no hue, so saturated
 * rating tones read as an intrusion. Lightness carries the rating instead —
 * light bubble = good, dark bubble = bad — which works because the ramp is
 * mirrored between schemes. Step k is the dark-scheme index and 17-k the
 * light-scheme one, so a high k is the lightest colour available in BOTH.
 *
 * Ink and ring share one colour, always the end of the ramp the bubble is
 * furthest from. That keeps the number legible at every step, and makes each
 * bubble read as a separate sticker where they overlap.
 */
const BUBBLE_STEP_MIN = 2
const BUBBLE_STEP_MAX = 16
/**
 * Scores at or below this all render darkest. The ratings are heavily
 * top-weighted — median 7.7, and 76% sit between 6 and 10 — so mapping the full
 * 0-10 range linearly would spend half the ramp on the ~10% below 4 and leave
 * the interesting band nearly flat. Clamping the floor roughly doubles the
 * slope where the places actually are.
 */
const BUBBLE_SCORE_FLOOR = 5

const rampVar = (index: number) =>
  index <= 8
    ? `var(--background-l${index})`
    : `var(--foreground-l${17 - index})`

/** The dark end of the ramp in both schemes. */
const DARK_END = "light-dark(var(--foreground-l0), var(--background-l0))"
/** The light end of the ramp in both schemes. */
const LIGHT_END = "light-dark(var(--background-l0), var(--foreground-l0))"

export const bubbleColorsForScore = (
  score: number | null,
  resolve: (value: string) => string,
) => {
  const span = 10 - BUBBLE_SCORE_FLOOR
  const rating =
    score === null
      ? 0.5
      : Math.min(Math.max((score - BUBBLE_SCORE_FLOOR) / span, 0), 1)
  const step = Math.round(
    BUBBLE_STEP_MIN + rating * (BUBBLE_STEP_MAX - BUBBLE_STEP_MIN),
  )
  return {
    fill: resolve(`light-dark(${rampVar(17 - step)}, ${rampVar(step)})`),
    // Ink flips so the number stays legible on any bubble...
    ink: resolve(step >= 9 ? DARK_END : LIGHT_END),
    // ...but the ring never goes light. A pale outline around a low score drew
    // the eye to exactly the places that should recede.
    ring: resolve(DARK_END),
  }
}

export const applyMapTheme = (
  map: MapLibreMap,
  resolveColor: (value: string) => string,
) => {
  // Deliberately NOT isStyleLoaded(): that also waits on every tile manager and
  // the sprite, so it is false throughout the style.load handler and the theme
  // would never be applied until some later event happened to re-trigger it.
  // Repainting only needs the style parsed, which an empty layer order detects.
  const order = map.getLayersOrder()
  if (!order.length) return

  const step = (index: number) =>
    index <= 8
      ? `var(--background-l${index})`
      : `var(--foreground-l${17 - index})`
  const tone = (light: number, dark: number) =>
    resolveColor(`light-dark(${step(light)}, ${step(dark)})`)

  // Surfaces stay in a narrow band so markers keep the contrast headroom —
  // Stamen's "compressed lightness range" rule for basemaps.
  const surface = {
    land: tone(0, 0),
    ice: tone(1, 1),
    park: tone(1, 1),
    wood: tone(2, 2),
    residential: tone(1, 1),
    aerodrome: tone(1, 1),
    building: tone(1, 2),
    buildingEdge: tone(2, 1),
    // Dark Matter reads water as lighter than land, Positron as darker.
    water: tone(4, 3),
    waterway: tone(4, 5),
  }
  // Roads carry the structure, so they get the widest spread of the basemap.
  const route = {
    casing: tone(3, 1),
    motorway: tone(0, 5),
    major: tone(1, 4),
    minor: tone(2, 3),
    subtle: tone(2, 2),
    path: tone(1, 1),
    tunnel: tone(1, 2),
    runway: tone(0, 2),
    taxiway: tone(2, 1),
    rail: tone(3, 2),
    railTransit: tone(2, 1),
  }
  // Thin dashed lines need more contrast than area fills to stay legible.
  const edge = {
    region: tone(5, 6),
    country: tone(6, 7),
  }
  // Labels live in the foreground half, ranked by settlement importance.
  const text = {
    country: tone(17, 17),
    city: tone(16, 16),
    state: tone(14, 15),
    town: tone(14, 15),
    village: tone(12, 11),
    poi: tone(12, 12),
    road: tone(12, 13),
    path: tone(11, 11),
    water: tone(12, 11),
    // Shield glyphs sit on light sprite artwork in both schemes.
    shield: tone(15, 0),
  }
  const halo = tone(0, 0)

  const landLabel = (ink: string): PaintOverrides => ({
    "text-color": ink,
    "text-halo-color": halo,
  })

  // Positron ships a fixed set of layer ids, so each one is themed by name.
  const layerPaint: Record<string, PaintOverrides> = {
    background: { "background-color": surface.land },

    park: { "fill-color": surface.park },
    landcover_wood: { "fill-color": surface.wood },
    landcover_ice_shelf: { "fill-color": surface.ice },
    landcover_glacier: { "fill-color": surface.ice },
    landuse_residential: { "fill-color": surface.residential },

    water: { "fill-color": surface.water },
    waterway: { "line-color": surface.waterway },

    building: {
      "fill-color": surface.building,
      "fill-outline-color": surface.buildingEdge,
    },

    "aeroway-area": { "fill-color": surface.aerodrome },
    "aeroway-runway": { "line-color": route.runway },
    "aeroway-runway-casing": { "line-color": route.taxiway },
    "aeroway-taxiway": { "line-color": route.taxiway },

    // Piers carve land shapes out of the water fill.
    road_area_pier: { "fill-color": surface.land },
    road_pier: { "line-color": surface.land },

    tunnel_motorway_casing: { "line-color": route.casing },
    tunnel_motorway_inner: { "line-color": route.tunnel },

    highway_path: { "line-color": route.path },
    highway_minor: { "line-color": route.minor },
    highway_major_casing: { "line-color": route.casing },
    highway_major_inner: { "line-color": route.major },
    highway_major_subtle: { "line-color": route.subtle },
    highway_motorway_casing: { "line-color": route.casing },
    highway_motorway_inner: { "line-color": route.motorway },
    highway_motorway_subtle: { "line-color": route.subtle },
    highway_motorway_bridge_casing: { "line-color": route.casing },
    highway_motorway_bridge_inner: { "line-color": route.motorway },

    // The dashlines overdraw the rail lines to produce the tie hatching.
    railway: { "line-color": route.rail },
    railway_dashline: { "line-color": surface.land },
    railway_service: { "line-color": route.railTransit },
    railway_service_dashline: { "line-color": surface.land },
    railway_transit: { "line-color": route.railTransit },
    railway_transit_dashline: { "line-color": surface.land },

    boundary_2: { "line-color": edge.country },
    boundary_3: { "line-color": edge.region },
    boundary_disputed: { "line-color": edge.region },

    waterway_line_label: landLabel(text.water),
    [DEDUPED_WATER_LABEL_LAYER]: {
      "text-color": text.water,
      "text-halo-color": surface.water,
    },
    water_name_point_label: {
      "text-color": text.water,
      "text-halo-color": surface.water,
    },
    water_name_line_label: {
      "text-color": text.water,
      "text-halo-color": surface.water,
    },

    "highway-name-path": landLabel(text.path),
    "highway-name-minor": landLabel(text.road),
    "highway-name-major": landLabel(text.road),

    "highway-shield-non-us": { "text-color": text.shield },
    "highway-shield-us-interstate": { "text-color": text.shield },
    road_shield_us: { "text-color": text.shield },

    airport: landLabel(text.poi),
    label_other: landLabel(text.town),
    label_village: landLabel(text.village),
    label_town: landLabel(text.town),
    label_state: landLabel(text.state),
    label_city: landLabel(text.city),
    label_city_capital: landLabel(text.city),
    label_country_3: landLabel(text.state),
    label_country_2: landLabel(text.country),
    label_country_1: landLabel(text.country),
  }

  // The id array directly; getStyle() would serialize every layer and source on
  // each call, and this runs on every theme change.
  for (const id of order) {
    const paint = layerPaint[id]
    if (!paint) {
      // Every Positron layer is listed above, so a miss means upstream renamed
      // something — surface it rather than guessing a colour.
      if (import.meta.env.DEV) {
        console.warn(`[map-style] no paint mapping for layer "${id}"`)
      }
      continue
    }
    for (const [property, value] of Object.entries(paint) as [
      keyof PaintOverrides,
      string,
    ][]) {
      map.setPaintProperty(id, property, value)
    }
  }
}
