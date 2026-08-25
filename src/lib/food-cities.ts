export type City = {
  readonly id: string
  readonly label: string
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly bounds: readonly [number, number, number, number]
}

export const EXCLUDED_PLACE_IDS: ReadonlySet<string> = new Set([
  "restaurants-77",
  "restaurants-105",
  "restaurants-270",
  "coffee-tea-76",
])

export const CITIES: readonly City[] = [
  {
    id: "manhattan",
    label: "Manhattan",
    center: [-73.9865, 40.7359],
    zoom: 11.2,
    bounds: [40.68, 40.88, -74.03, -73.9],
  },
  {
    id: "los-angeles",
    label: "Los Angeles County",
    center: [-118.2577, 33.9574],
    zoom: 8.5,
    bounds: [33.6, 34.5, -118.95, -118.05],
  },
  {
    id: "orange-county",
    label: "Orange County",
    center: [-117.8603, 33.753],
    zoom: 9.2,
    bounds: [33.35, 33.99, -118.05, -117.4],
  },
  {
    id: "san-diego",
    label: "San Diego",
    center: [-117.1519, 32.7719],
    zoom: 9.3,
    bounds: [32.45, 33.35, -117.45, -116.7],
  },
  {
    id: "bay-area",
    label: "Bay Area",
    center: [-122.3036, 37.6048],
    zoom: 8.6,
    bounds: [37.2, 38.05, -122.6, -121.7],
  },
  {
    id: "las-vegas",
    label: "Las Vegas",
    center: [-115.1671, 36.1289],
    zoom: 10.7,
    bounds: [35.9, 36.4, -115.45, -114.9],
  },
  {
    id: "tokyo",
    label: "Tokyo",
    center: [139.7475, 35.6283],
    zoom: 10.4,
    bounds: [35.45, 35.9, 139.4, 140.0],
  },
  {
    id: "kansai",
    label: "Kansai",
    center: [135.6702, 34.8367],
    zoom: 8.7,
    bounds: [34.4, 35.2, 135.3, 136.1],
  },
  {
    id: "niseko",
    label: "Niseko",
    center: [140.6978, 42.8483],
    zoom: 11.3,
    bounds: [42.7, 43.0, 140.55, 140.85],
  },
  {
    id: "taipei",
    label: "Taipei",
    center: [121.5115, 25.0662],
    zoom: 11.1,
    bounds: [24.9, 25.2, 121.4, 121.7],
  },
  {
    id: "ho-chi-minh",
    label: "Ho Chi Minh City",
    center: [106.6961, 10.7969],
    zoom: 10.6,
    bounds: [10.6, 10.95, 106.55, 106.85],
  },
  {
    id: "hanoi",
    label: "Hanoi",
    center: [105.8491, 21.0283],
    zoom: 11.9,
    bounds: [20.9, 21.15, 105.75, 105.95],
  },
  {
    id: "nha-trang",
    label: "Nha Trang",
    center: [109.192, 12.2477],
    zoom: 11.9,
    bounds: [12.15, 12.35, 109.1, 109.3],
  },
  {
    id: "zurich",
    label: "Zürich",
    center: [8.5324, 47.3785],
    zoom: 11.9,
    bounds: [47.28, 47.46, 8.42, 8.65],
  },
  {
    id: "malta",
    label: "Malta",
    center: [14.4816, 35.8772],
    zoom: 9.7,
    bounds: [35.79, 36.02, 14.32, 14.6],
  },
]

export const DEFAULT_CITY_ID = "manhattan"

export const cityById = (id: string | null | undefined) =>
  CITIES.find((city) => city.id === id)

export const cityIndexForPlace = (
  id: string,
  latitude: number,
  longitude: number,
) => {
  if (EXCLUDED_PLACE_IDS.has(id)) return -1
  return CITIES.findIndex(
    ({ bounds: [south, north, west, east] }) =>
      latitude >= south &&
      latitude <= north &&
      longitude >= west &&
      longitude <= east,
  )
}
