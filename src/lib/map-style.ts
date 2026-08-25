import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl"

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron"

export const MAP_LABEL_FONTS = [
  "MD Lorien",
  "Noto Sans",
  "Helvetica Neue",
  "Arial",
  "Segoe UI",
  "Hiragino Sans",
  "Yu Gothic",
  "Meiryo",
  "Noto Sans JP",
  "Microsoft JhengHei",
  "Noto Sans TC",
  "Arial Unicode MS",
]

export type LoadMapStyleOptions = {
  keepLayerIds?: ReadonlySet<string>
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

type TextField = NonNullable<SymbolLayerSpecification["layout"]>["text-field"]

const LABEL_NAME_KEYS = ["name:en", "name:latin", "name"] as const

const singleLanguage = (textField: TextField): TextField => {
  if (!JSON.stringify(textField)?.includes("name:nonlatin")) return textField
  return [
    "coalesce",
    ...LABEL_NAME_KEYS.map((key) => ["get", key]),
  ] as TextField
}

export const loadMapStyle = async (options: LoadMapStyleOptions = {}) => {
  const [, response] = await Promise.all([
    document.fonts.load('16px "MD Lorien"'),
    fetch(MAP_STYLE_URL),
  ])
  if (!response.ok) {
    throw new Error(`Unable to load map style (${response.status})`)
  }

  const style = (await response.json()) as StyleSpecification
  delete style.glyphs
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

const WATER_LABEL_LAYERS = [
  "water_name_point_label",
  "water_name_line_label",
] as const

const DEDUPED_SOURCE = "water-name-deduped"
export const DEDUPED_WATER_LABEL_LAYER = "water_name_deduped_label"

const labelOf = (properties: Record<string, unknown>) =>
  LABEL_NAME_KEYS.map((key) => properties[key]).find(
    (value): value is string => typeof value === "string" && value.length > 0,
  )

const translationCount = (properties: Record<string, unknown>) =>
  Object.keys(properties).filter((key) => key.startsWith("name")).length

type SourceFeature = ReturnType<MapLibreMap["querySourceFeatures"]>[number]

type LabelFeature = {
  type: "Feature"
  properties: { label: string }
  geometry: { type: "Point"; coordinates: [number, number] }
}

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

export const collapseDuplicateWaterLabels = (map: MapLibreMap) => {
  const baseFilters = new Map<string, FilterSpecification | undefined>()
  for (const id of WATER_LABEL_LAYERS) {
    if (map.getLayer(id)) baseFilters.set(id, map.getFilter(id) || undefined)
  }
  if (!baseFilters.size) return

  type Candidate = { rank: number; anchor: [number, number] }
  const seen = new Map<string, Map<number, Candidate>>()

  map.addSource(DEDUPED_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  })
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

export const TILE_ZOOM_RANGE = { min: 7, max: 12 } as const

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

export const toneForScore = (score: number | null) =>
  TONE_VAR[toneKeyForScore(score)]

export const toneIndexForScore = (score: number | null) =>
  TONE_KEYS.indexOf(toneKeyForScore(score))

const BUBBLE_STEP_MIN = 2
const BUBBLE_STEP_MAX = 16
const BUBBLE_SCORE_FLOOR = 5

const rampVar = (index: number) =>
  index <= 8
    ? `var(--background-l${index})`
    : `var(--foreground-l${17 - index})`

const DARK_END = "light-dark(var(--foreground-l0), var(--background-l0))"
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
    ink: resolve(step >= 9 ? DARK_END : LIGHT_END),
    ring: resolve(DARK_END),
  }
}

export const applyMapTheme = (
  map: MapLibreMap,
  resolveColor: (value: string) => string,
) => {
  const order = map.getLayersOrder()
  if (!order.length) return

  const step = (index: number) =>
    index <= 8
      ? `var(--background-l${index})`
      : `var(--foreground-l${17 - index})`
  const tone = (light: number, dark: number) =>
    resolveColor(`light-dark(${step(light)}, ${step(dark)})`)

  const surface = {
    land: tone(0, 0),
    ice: tone(1, 1),
    park: tone(1, 1),
    wood: tone(2, 2),
    residential: tone(1, 1),
    aerodrome: tone(1, 1),
    building: tone(1, 2),
    buildingEdge: tone(2, 1),
    water: tone(4, 3),
    waterway: tone(4, 5),
  }
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
  const edge = {
    region: tone(5, 6),
    country: tone(6, 7),
  }
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
    shield: tone(15, 0),
  }
  const halo = tone(0, 0)

  const landLabel = (ink: string): PaintOverrides => ({
    "text-color": ink,
    "text-halo-color": halo,
  })

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

  for (const id of order) {
    const paint = layerPaint[id]
    if (!paint) {
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
