# Performance Optimizations Design
**Date:** 2026-04-11
**Scope:** High and medium impact items from the optimization backlog

---

## Overview

Four targeted improvements to eliminate redundant network requests, reduce unnecessary computed re-evaluation, and improve rendering performance for the farms list. No new pages or user-facing features — all changes are internal.

---

## Items in Scope

| # | Item | Impact |
|---|------|--------|
| 1 | Redundant microplastics API calls | High |
| 2 | `inputTotals`/`inputDrilldown` cascading re-computation | Medium-High |
| 3 | No virtual scrolling on farms list | Medium |
| 5 | No request deduplication in `useLatestSampleDate` | Medium |

*Items 4 (test coverage) and 6 (bundle analysis) are deferred.*

---

## Approach

Approach B: **Pinia stores for shared async state.**

The root cause of items 1 and 5 is that composables were used for app-wide singleton data. Each call to a composable creates a fresh instance — including a fresh `ref` and a fresh network request. Pinia stores are module-level singletons and solve this structurally, without manual fetch guards bolted onto composable scope.

Items 2 and 3 are fixed in place with surgical changes to existing files.

---

## Section 1: New Pinia Stores

### `src/stores/microplastics.js` — `useMicroplasticsStore`

**Responsibilities:**
- Owns the single fetch of the `microplastics` Directus collection
- Derives `colorData` and `sizeData` as computed properties from the shared `rawItems`
- Exposes `selectedSizeField` ref (previously lived in `useInsightData`)

**State:**
- `rawItems: []` — full microplastics array, populated on first fetch
- `loading: false`
- `error: null`
- `selectedSizeField: ref('equivalent_circular_diameter_um')`

**Actions:**
- `fetch()` — guarded: `if (rawItems.length) return`. Calls `readItems('microplastics', { limit: -1 })`. Sets `rawItems`.

**Computed:**
- `colorData` — same bucketing logic currently in `fetchColorData()` in `useInsightData.js`
- `sizeData` — same bucketing logic currently in `fetchSizeData()` in `useInsightData.js`, reads `selectedSizeField`

**Effect:** One network request per session regardless of how many components need microplastics data.

---

### `src/stores/sampleDate.js` — `useSampleDateStore`

**Responsibilities:**
- Owns the single fetch of the latest `soilsamples` date
- Exposes `displayLatestSampleDate` computed for formatted display

**State:**
- `latestSampleDate: null`
- `loading: false`
- `fetched: false` — guards against repeat calls

**Actions:**
- `fetch()` — guarded: `if (fetched) return`. Calls `readItems('soilsamples', { sort: ['-date_collected'], limit: 1 })`. Sets `latestSampleDate` and `fetched = true`.

**Computed:**
- `displayLatestSampleDate` — same formatting logic currently in `useLatestSampleDate.js`

**Effect:** One network request per session regardless of how many components call `useSampleDateStore().fetch()`.

---

## Section 2: Integrating with Existing Code

### `useInsightData.js`

Remove:
- `fetchColorData()`, `fetchSizeData()` functions
- `colorData`, `colorLoading`, `sizeData`, `selectedSizeField` refs
- All related logic

Update `loadAll()`:
```js
async function loadAll() {
  await loadSites()
  useMicroplasticsStore().fetch() // fire-and-forget, non-blocking
}
```

Only `src/pages/insight/index.vue` reads `colorData`, `sizeData`, `selectedSizeField`, and `colorLoading` from `useInsightData`. It will destructure these from `useMicroplasticsStore()` instead. It also passes `colorData` into `useInsightKPIs(sites, colorData)` — this call site is unchanged; `index.vue` just sources `colorData` from the store ref.

The `watch(selectedSizeField, newVal => fetchSizeData(newVal))` watcher in `index.vue` is **deleted**. After migration, `sizeData` in the store is a `computed` that reads `selectedSizeField` reactively — changing the field auto-updates `sizeData` with no manual trigger needed.

### `useLatestSampleDate.js`

**Delete the file.** It is replaced entirely by `useSampleDateStore`.

All 6 consumers update from:
```js
const { displayLatestSampleDate } = useLatestSampleDate()
```
to:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

Files to update:
- `src/pages/insight/index.vue`
- `src/pages/insight/[farm_name].vue`
- `src/components/graphs/MonthlyTrendChart.vue`
- `src/components/graphs/SiteDrilldownChart.vue`
- `src/components/PreviewCard.vue`
- `src/components/AISummary.vue`

---

## Section 3: Computed Optimization — `sitesByInput`

**File:** `src/composables/useInsightCharts.js`

Add a `sitesByInput` computed that groups sites by input type in a single O(N) pass:

```js
const sitesByInput = computed(() => {
  const map = new Map(INPUT_TYPES.map(t => [t, []]))
  for (const s of sites.value) {
    for (const type of INPUT_TYPES) {
      if (siteHasActivity(s, type)) map.get(type).push(s)
    }
  }
  return map
})
```

Rewrite `inputTotals` and `inputDrilldown` to read from `sitesByInput.value.get(type)` instead of re-filtering `sites.value`. This mirrors the existing `sitesByTexture` → `textureTotals`/`textureDrilldown` pattern already in the file.

---

## Section 4: Virtual Scroll — `SampledFarms.vue`

**File:** `src/components/SampledFarms.vue`

Replace the `<ul>/<li>` list with Vuetify's `<v-virtual-scroll>`:

```html
<v-virtual-scroll
  :items="visibleSites"
  :item-height="72"
  :class="['sampled-farms', { 'no-max-height': !showMap }]"
>
  <template #default="{ item: site }">
    <div class="farm-row" ...>
      <!-- same content as current <li> -->
    </div>
  </template>
</v-virtual-scroll>
```

**Height constraints:**
- With map (`.sampled-farms`): `height: 250px` (was `max-height: 250px`)
- Without map (`.no-max-height`): `height: 480px`

Virtual scroll requires a fixed height, not `max-height`. When few items exist, Vuetify renders them all — no visual difference for small datasets. For large datasets, only visible rows are in the DOM.

`item-height: 72` accounts for: farm-name row (~24px) + farm-addr row (~18px) + gap (4px) + vertical padding (14px × 2) + row gap (12px) ≈ 72px.

---

## Data Flow (After Changes)

```
App mount
  └─ useInsightData.loadAll()
       ├─ loadSites()                     → sites ref
       └─ useMicroplasticsStore.fetch()   → rawItems → colorData, sizeData (computed)

Component mount (any of 6)
  └─ useSampleDateStore.fetch()           → latestSampleDate → displayLatestSampleDate (computed)
     (2nd–6th calls are no-ops)

useInsightCharts(sites)
  ├─ sitesByInput (computed, O(N))        → inputTotals, inputDrilldown
  ├─ sitesByTexture (computed, O(N))      → textureTotals, textureDrilldown  [existing]
  └─ sitesByPractice (computed, O(N))     → contaminationByPracticeSeries    [existing]
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/stores/microplastics.js` | **New** |
| `src/stores/sampleDate.js` | **New** |
| `src/composables/useInsightData.js` | Remove color/size fetch logic; update `loadAll` |
| `src/composables/useLatestSampleDate.js` | **Delete** |
| `src/composables/useInsightCharts.js` | Add `sitesByInput` computed; rewrite `inputTotals`/`inputDrilldown` |
| `src/components/SampledFarms.vue` | Replace `<ul>/<li>` with `<v-virtual-scroll>` |
| `src/pages/insight/index.vue` | Switch to `useSampleDateStore` + check `colorData`/`sizeData` source |
| `src/pages/insight/[farm_name].vue` | Switch to `useSampleDateStore` |
| `src/components/graphs/MonthlyTrendChart.vue` | Switch to `useSampleDateStore` |
| `src/components/graphs/SiteDrilldownChart.vue` | Switch to `useSampleDateStore` |
| `src/components/PreviewCard.vue` | Switch to `useSampleDateStore` |
| `src/components/AISummary.vue` | Switch to `useSampleDateStore` |

---

## Out of Scope

- Test coverage for new/changed composables (backlog item 4 — deferred)
- Bundle analysis / lazy-loading (backlog item 6 — deferred)
- Any UI or feature changes
