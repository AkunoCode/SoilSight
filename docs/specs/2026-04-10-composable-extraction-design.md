# Design: Composable Extraction & Microplastic Helper

**Date:** 2026-04-10
**Scope:** `src/pages/index.vue` (map), `src/pages/insight/index.vue` (insights)
**Goal:** Extract bloated inline logic into focused composables and a shared utility module. Addresses improvements A (component bloat) and B (duplicated microplastic calculations).

---

## Problem

Both pages contain large amounts of inline logic that violates single responsibility:

- `insight/index.vue` is **647 lines** — data fetching, KPI calculations, chart data builders, and utility functions are all co-located in one `<script setup>`.
- `index.vue` (map) is **~590 lines** — marker creation, Leaflet map setup, filter logic, and data fetching are all inline.
- The formula `fragment_count + fiber_count + foam_count + film_count + sheets_count` is copy-pasted **15+ times** across 5 files with slight inconsistencies (`sheets_count` vs `sheet_count` vs `sheets`).

---

## Solution: Option 2 — Shared Utility + Full Composable Extraction

### New Files

#### `src/utils/microplasticsHelper.js`

Pure functions with no Vue reactivity. Single source of truth for all microplastic field access.

```
calculateTotalMP(item)        — canonical MP sum, handles all sheets_* field variants
morphologyIndex(shape)        — shape string → array index [0–4]
sanitizeSiteName(name)        — strips "Farm", cleans separators (-, –, /)
siteHasActivity(site, type)   — normalised plastic_activity array/string check
toNumber(v)                   — safe Number() that returns NaN on null/empty
areaToDiameter(area)          — converts area_um2 to equivalent circular diameter
```

No imports from Vue. Usable in composables, components, and future tests.

---

#### `src/composables/useInsightData.js`

Owns all three Directus fetches for the insight page. Exposes:

```
// State
sites              Ref<Array>     — raw site records with nested soilsamples
loading            Ref<Boolean>
error              Ref<Error|null>
colorData          Ref<Object|null>   — aggregated color chart data
colorLoading       Ref<Boolean>
sizeData           Ref<Object|null>   — aggregated size chart data
selectedSizeField  Ref<String>        — 'equivalent_circular_diameter_um' (default)

// Methods
loadAll()          — fetches sites, color data, size data in sequence (used by onMounted)
fetchSizeData(field) — re-fetches size data when selectedSizeField changes (used by watcher)
```

Internally uses `morphologyIndex`, `toNumber`, `areaToDiameter` from the helper.
The page no longer contains any fetch logic or raw Directus calls.

---

#### `src/composables/useInsightKPIs.js`

Signature: `useInsightKPIs(sites, colorData)` where `sites` is a `Ref<Array>` and `colorData` is the `Ref<Object|null>` from `useInsightData` (needed to resolve the most common color for the dominant shape). Returns computed KPI values:

```
microplasticTotals    — { fragments, fibers, foams, films, sheets }
avgContaminationDensity  — string, MP/kg averaged across sites
dominantPollutant        — string, e.g. "Black Fragments"
highestRiskSite          — { name, density }
```

Uses `calculateTotalMP` for all per-site totals. `dominantPollutant` additionally accepts an optional `colorData` ref to resolve the most common color for the dominant shape.

---

#### `src/composables/useInsightCharts.js`

Accepts `sites` (Ref/ComputedRef) and `sizeData` (Ref). Returns all chart series and options computeds:

```
contaminationByPracticeSeries   — series for MPPracticeBar
contaminationByPracticeOptions  — options for MPPracticeBar
inputTotals / inputDrilldown    — source identification data
siteCategories / siteTotals / siteDrilldown  — site drilldown data
textures / textureTotals / textureDrilldown  — texture breakdown
biologicalRiskData              — risk bin array for BiologicalRiskChart
farmSizeSeries / farmSizeOptions — farm size bar chart
topCrops                        — top 10 crops by count
```

Uses `calculateTotalMP`, `sanitizeSiteName`, `siteHasActivity` from the helper internally.

---

#### `src/composables/useMapMarkers.js`

Accepts `allFarmsData` (Ref<Array>) and `mapRef` (Ref<LeafletMap|null>). Encapsulates all Leaflet marker logic:

```
markersRef       Ref<Array>   — active Leaflet marker instances
getMarkerColor(practice)      — practice string → hex color
createMarker(item)            — builds Leaflet marker with popup; uses calculateTotalMP
clearMarkers()                — removes all active markers from map
addMarkers(items)             — clears then re-adds for a filtered item list
```

Replaces the two inline copies of `calculateTotalMP` inside `createMarker` in `index.vue`.

---

## Pages After Refactor

### `insight/index.vue`
**647 lines → ~180 lines**

Keeps only:
- Template (unchanged)
- `onMounted` — calls `loadAll()`, `fetchLatestSampleDate()`
- Watcher on `selectedSizeField` — calls `fetchSizeData()`
- `printReport()` function
- `handleLegendClick()` function
- Wiring: destructure from composables and pass to child components

### `index.vue` (map page)
**~590 lines → ~320 lines**

Keeps only:
- Template (unchanged)
- Map initialisation (Leaflet setup, tile layer, GeoJSON, legend)
- `applyFilters()` — filter/search logic
- Breadcrumb navigation functions (`gotoRegion`, `gotoCity`, `gotoFarm`)
- Debounced watcher on `searchText` / `selectedCategory`

---

## Data Flow

```
Directus API
    └─▶ useInsightData        (fetches, holds raw state)
            ├─▶ useInsightKPIs    (computed KPIs from sites)
            └─▶ useInsightCharts  (computed chart series from sites + sizeData)
                        │
                    insight/index.vue  (wires composables → template)

microplasticsHelper.js
    └─▶ used by: useInsightData, useInsightKPIs, useInsightCharts, useMapMarkers
```

---

## Out of Scope

- Error handling / loading state UI (separate improvement C)
- Constants config file (separate improvement D)
- Tests (would be the first thing to add after this refactor makes composables independently testable)
- `insight/[farm_name].vue` — has its own fetch pattern, addressed separately

---

## Invariants

- Templates in both pages are **not modified** — only `<script setup>` changes
- No new dependencies
- All existing prop names and component interfaces remain unchanged
- `calculateTotalMP` must handle the `sheets_count || sheet_count || sheets` variant to stay consistent with current behaviour
