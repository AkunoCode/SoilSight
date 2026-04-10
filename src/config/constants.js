// src/config/constants.js

// ── Map ──────────────────────────────────────────────────────────────
/** Default center of Tayabas City [lat, lng] */
export const MAP_CENTER = [13.9649, 121.5923]

/** Zoom level showing the whole city area */
export const MAP_ZOOM_CITY = 13

/** Zoom level showing the wider region */
export const MAP_ZOOM_REGION = 11

/** Zoom level for a focused farm view */
export const MAP_ZOOM_FARM = 16

/** Maximum tile zoom level */
export const MAP_ZOOM_MAX = 19

/** fitBounds padding [topLeft, bottomRight] in pixels */
export const MAP_BOUNDS_PADDING = { topLeft: [350, 50], bottomRight: [50, 50] }

/** Initial horizontal pan offset (px) to make room for the left panel */
export const MAP_INITIAL_PAN_X = -160

/** Search/filter debounce delay in milliseconds */
export const SEARCH_DEBOUNCE_MS = 180

// ── Markers ──────────────────────────────────────────────────────────
export const MARKER_COLOR_INTEGRATED  = '#FF9800'
export const MARKER_COLOR_ORGANIC     = '#4CAF50'
export const MARKER_COLOR_CONVENTIONAL = '#19568E'
export const MARKER_COLOR_OTHER       = '#757575'

/** Minimum marker diameter in pixels (used for sites with lowest MP count) */
export const MARKER_SIZE_MIN = 15

/** Maximum marker diameter in pixels (used for sites with highest MP count) */
export const MARKER_SIZE_MAX = 35

/** Radius for the circle marker in LeafletMap.vue */
export const MARKER_CIRCLE_RADIUS = 8

/** Stroke weight for the circle marker in LeafletMap.vue */
export const MARKER_CIRCLE_WEIGHT = 2

// ── Microplastic size buckets ─────────────────────────────────────────
/** Ordered size range definitions shared by useInsightData and [farm_name].vue */
export const MP_SIZE_BUCKETS = [
  { label: '1-20 µm',     min: 1,    max: 20   },
  { label: '20-100 µm',   min: 20,   max: 100  },
  { label: '100-500 µm',  min: 100,  max: 500  },
  { label: '500 µm-1 mm', min: 500,  max: 1000 },
  { label: '1-5 mm',      min: 1000, max: 5000 },
]

// ── Responsive ───────────────────────────────────────────────────────
/** Viewport width (px) below which the mobile warning is shown */
export const MOBILE_BREAKPOINT_PX = 900
