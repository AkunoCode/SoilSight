# Error Handling, Constants Config, and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve resilience and accessibility of SoilSight by adding error fallback UI, centralizing magic numbers into a config file, and fixing keyboard/screen-reader accessibility gaps.

**Architecture:** Three independent subsystems — each group of tasks (C, D, E) can be executed separately without dependencies on the others. Within Priority C, Tasks 1–2 (components) must be done before Tasks 3–5 (wiring). Within Priority D, Task 6 (constants file) must be done before Tasks 7–12. Priority E is fully independent.

**Tech Stack:** Vue 3 (Composition API), Vitest + happy-dom + @vue/test-utils, Vuetify 3, Leaflet, Pinia

---

## File Map

### Priority C — Error Handling & Loading States
- **Create:** `src/components/ErrorBanner.vue` — reusable error message card with retry button
- **Create:** `src/components/ErrorBanner.test.js` — unit tests
- **Modify:** `src/pages/insight/index.vue` — show ErrorBanner when API fails, boneyard-js Skeleton wrappers while loading
- **Modify:** `src/pages/index.vue` — show error snackbar when Directus fetch fails
- **Modify:** `src/pages/insight/[farm_name].vue` — show ErrorBanner when farm not found

### Priority D — Constants Config File
- **Create:** `src/config/constants.js` — all magic numbers and hardcoded values
- **Modify:** `src/composables/useMapMarkers.js` — import marker colors and size limits
- **Modify:** `src/pages/index.vue` — import map zoom levels, center coords, padding, debounce delay
- **Modify:** `src/components/LeafletMap.vue` — import circle marker radius and weight
- **Modify:** `src/composables/useInsightData.js` — import MP_SIZE_BUCKETS
- **Modify:** `src/pages/insight/[farm_name].vue` — import MP_SIZE_BUCKETS
- **Modify:** `src/router/index.js` — import MOBILE_BREAKPOINT_PX

### Priority E — Accessibility
- **Modify:** `src/pages/insight/index.vue` — fix back button and print button accessibility
- **Modify:** `src/pages/insight/[farm_name].vue` — fix back button and print button accessibility
- **Modify:** `src/pages/index.vue` — fix breadcrumb spans and map container

---

## Priority C — Error Handling & Loading States

---

### Task 1: Create ErrorBanner component

**Files:**
- Create: `src/components/ErrorBanner.vue`
- Create: `src/components/ErrorBanner.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/components/ErrorBanner.test.js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorBanner from './ErrorBanner.vue'

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Failed to load data' } })
    expect(wrapper.text()).toContain('Failed to load data')
  })

  it('has role="alert" for screen readers', () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Error' } })
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it('emits retry when retry button is clicked', async () => {
    const wrapper = mount(ErrorBanner, { props: { message: 'Error' } })
    await wrapper.find('[data-testid="retry-btn"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- ErrorBanner
```
Expected: FAIL — `ErrorBanner.vue` does not exist

- [ ] **Step 3: Implement the component**

```html
<!-- src/components/ErrorBanner.vue -->
<template>
  <div class="error-banner" role="alert">
    <span class="error-banner__icon" aria-hidden="true">⚠</span>
    <span class="error-banner__message">{{ message }}</span>
    <button class="error-banner__retry" data-testid="retry-btn" @click="$emit('retry')">
      Retry
    </button>
  </div>
</template>

<script setup>
defineProps({ message: { type: String, required: true } })
defineEmits(['retry'])
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff8e1;
  border: 1px solid #ffca2c;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.error-banner__icon { font-size: 1.2rem; }
.error-banner__message { flex: 1; color: #664d03; font-weight: 500; }
.error-banner__retry {
  background: #0d6efd;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}
.error-banner__retry:hover { background: #0b5ed7; }
.error-banner__retry:focus-visible { outline: 2px solid #0d6efd; outline-offset: 2px; }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- ErrorBanner
```
Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorBanner.vue src/components/ErrorBanner.test.js
git commit -m "feat: add ErrorBanner component with retry button"
```

---

### Task 2: Install boneyard-js skeleton library

**Files:**
- Modify: `package.json` (via pnpm add)
- Modify: `src/main.js` — no plugin registration needed; components are imported directly per use

boneyard-js wraps your real components: `<Skeleton name="card" :loading="loading"><Card /></Skeleton>`. On first render it extracts the layout into a `.bones.json` file; subsequent renders use that file to show the skeleton. No manual shape-drawing required.

- [ ] **Step 1: Install the package**

```bash
pnpm add boneyard-js
```
Expected: package added to `dependencies` in `package.json`

- [ ] **Step 2: Verify the import resolves**

```bash
node -e "import('boneyard-js/vue').then(() => console.log('ok'))"
```
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add boneyard-js for auto-generated skeleton loaders"
```

---

### Task 3: Wire error + boneyard skeleton into insight/index.vue

**Files:**
- Modify: `src/pages/insight/index.vue`

`useInsightData` already exposes `error` (set when `loadSites()` throws) and `loading` (true while fetching). The template needs to show `ErrorBanner` when `error` is truthy and boneyard-js `<Skeleton>` placeholders while `loading` is true.

- [ ] **Step 1: Add ErrorBanner import and boneyard Skeleton import**

At the top of the `<script setup>` in `src/pages/insight/index.vue`, add:

```js
import Skeleton from 'boneyard-js/vue'
```

(ErrorBanner is auto-imported from `src/components/` — no manual import needed.)

- [ ] **Step 2: Add ErrorBanner after the page header**

In `src/pages/insight/index.vue`, after the `<header class="page-header">` block (around line 69), add:

```html
<ErrorBanner
  v-if="error"
  :message="error?.message || 'Failed to load data. Please check your connection or try again.'"
  @retry="loadAll"
/>
```

- [ ] **Step 3: Wrap the AI Summary and Sampled Farms cards with Skeleton**

Replace the very first `VRow` (the AI Summary + Sampled Farms row, around line 94) with:

```html
<VRow class="mt-2">
  <VCol cols="6">
    <div class="card">
      <Skeleton name="ai-summary" :loading="loading">
        <AISummary />
      </Skeleton>
    </div>
  </VCol>
  <VCol cols="6">
    <div class="card list-card map-card">
      <h3 class="mb-2">Contamination Density by Farm Practice</h3>
      <Skeleton name="sampled-farms" :loading="loading">
        <SampledFarms :sampled-sites="sites" />
      </Skeleton>
    </div>
  </VCol>
</VRow>
```

- [ ] **Step 4: Verify the page renders without errors**

```bash
pnpm dev
```
Navigate to the insight page. On first load, boneyard extracts the skeleton layout. Confirm no console errors and the page loads normally.

- [ ] **Step 5: Verify error state (manual test)**

Temporarily rename `.env` to `.env.bak`, restart dev server, navigate to insight page. You should see the yellow error banner with a Retry button instead of a blank screen.

Restore: `mv .env.bak .env`

- [ ] **Step 6: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "feat: show ErrorBanner and boneyard skeleton loaders in insight overview page"
```

---

### Task 4: Wire error state into the map page (index.vue)

**Files:**
- Modify: `src/pages/index.vue`

The map page currently catches `dataError` silently (line 188). Add a reactive `dataError` ref and show a `VSnackbar` error notification since the page is map-first and a full `ErrorBanner` would cover the map.

- [ ] **Step 1: Add dataError ref in script setup**

In `src/pages/index.vue`, after the existing `let debounceTimer = null` (line 65), add:

```js
const dataError = ref(null)
```

- [ ] **Step 2: Update fetchDataFromDirectus to set the ref on failure**

Replace the catch block in `fetchDataFromDirectus` (lines 75–78):

```js
} catch (error) {
  console.error('Error fetching farms data from Directus:', error)
  dataError.value = error?.message || 'Failed to load farm data. Check your connection.'
  throw error
}
```

- [ ] **Step 3: Add VSnackbar to the template**

In `src/pages/index.vue`, inside `<v-main>` after `<div id="map" />` (line 37), add:

```html
<VSnackbar
  v-model="dataError"
  color="warning"
  timeout="8000"
  location="top"
  :text="typeof dataError === 'string' ? dataError : 'Failed to load farm data.'"
>
  <template #actions>
    <VBtn variant="text" @click="dataError = null">Dismiss</VBtn>
  </template>
</VSnackbar>
```

Note: `v-model` on VSnackbar accepts a boolean. Change the ref to a boolean and store the message separately:

Replace the `dataError` ref and usage:

```js
const dataError    = ref(false)
const dataErrorMsg = ref('')
```

Update `fetchDataFromDirectus` catch:
```js
} catch (error) {
  console.error('Error fetching farms data from Directus:', error)
  dataErrorMsg.value = error?.message || 'Failed to load farm data. Check your connection.'
  dataError.value = true
  throw error
}
```

Update the template to:
```html
<VSnackbar
  v-model="dataError"
  color="warning"
  timeout="8000"
  location="top"
>
  {{ dataErrorMsg }}
  <template #actions>
    <VBtn variant="text" @click="dataError = false">Dismiss</VBtn>
  </template>
</VSnackbar>
```

- [ ] **Step 4: Verify the map still loads normally**

```bash
pnpm dev
```
Open the map page. Confirm markers load and no errors appear.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.vue
git commit -m "feat: show warning snackbar when map data fails to load"
```

---

### Task 5: Wire error state into insight/[farm_name].vue

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`

When the farm is not found (fetchFarmFromDirectus returns null), `farm.value` is null and the page renders empty strings everywhere. Show an error state instead.

- [ ] **Step 1: Add farmNotFound ref**

In `src/pages/insight/[farm_name].vue`, after `const farm = ref(null)` (line 27), add:

```js
const farmNotFound = ref(false)
```

- [ ] **Step 2: Set farmNotFound when lookup returns null**

In the `watch(farm, ...)` handler (lines 393–414), change the `else` branch:

```js
} else {
  farmNotFound.value = true
  latestSampleDate.value = null
  colorComparisonFetched.value = null
  sizeComparisonData.value = null
  comparisonSites.value = null
}
```

And in `watch(farmParam, ...)` (lines 389–391), reset `farmNotFound` before the fetch:

```js
watch(farmParam, async () => {
  farmNotFound.value = false
  farm.value = await fetchFarmFromDirectus(farmParam.value)
}, { immediate: true })
```

- [ ] **Step 3: Add error banner to the template**

In `src/pages/insight/[farm_name].vue`, inside `<div class="insight-page">`, add after the opening tag:

```html
<ErrorBanner
  v-if="farmNotFound"
  :message="`Farm '${farmParam}' could not be found. It may have been removed or the name is incorrect.`"
  @retry="$router.back()"
/>
```

- [ ] **Step 4: Guard the main content block**

Wrap the `<div class="d-flex align-center justify-space-between mb-8">` header and all subsequent `VRow` blocks with `<template v-if="!farmNotFound">...</template>`:

```html
<template v-if="!farmNotFound">
  <div class="d-flex align-center justify-space-between mb-8">
    ...
  </div>
  <!-- all VRow blocks -->
</template>
```

- [ ] **Step 5: Verify normal farm page still works**

```bash
pnpm dev
```
Navigate to an existing farm's detail page. Confirm everything renders correctly.

- [ ] **Step 6: Verify not-found state**

Navigate to `/insight/NonExistentFarm`. You should see the error banner and nothing else.

- [ ] **Step 7: Commit**

```bash
git add src/pages/insight/\[farm_name\].vue
git commit -m "feat: show ErrorBanner when farm lookup returns no result"
```

---

## Priority D — Constants Config File

---

### Task 6: Create src/config/constants.js

**Files:**
- Create: `src/config/constants.js`

No new tests needed — existing tests cover all behavior. After completing Tasks 7–12, run `pnpm test` to confirm no regressions.

- [ ] **Step 1: Write the constants file**

```js
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
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
node --input-type=module < src/config/constants.js
```
Expected: no output, no error

- [ ] **Step 3: Commit**

```bash
git add src/config/constants.js
git commit -m "feat: add constants.js to centralize magic numbers"
```

---

### Task 7: Update useMapMarkers.js to use constants

**Files:**
- Modify: `src/composables/useMapMarkers.js`

- [ ] **Step 1: Add import**

At the top of `src/composables/useMapMarkers.js`, add after the existing imports:

```js
import {
  MARKER_COLOR_INTEGRATED,
  MARKER_COLOR_ORGANIC,
  MARKER_COLOR_CONVENTIONAL,
  MARKER_COLOR_OTHER,
  MARKER_SIZE_MIN,
  MARKER_SIZE_MAX,
} from '@/config/constants.js'
```

- [ ] **Step 2: Replace hardcoded values in getMarkerColor**

Replace the function body (lines 8–13):

```js
function getMarkerColor(practice) {
  const p = (practice || '').toLowerCase()
  if (p.includes('integrated'))   return MARKER_COLOR_INTEGRATED
  if (p.includes('organic'))      return MARKER_COLOR_ORGANIC
  if (p.includes('conventional')) return MARKER_COLOR_CONVENTIONAL
  return MARKER_COLOR_OTHER
}
```

- [ ] **Step 3: Replace hardcoded min/max size in createMarker**

Replace lines 24–25:

```js
const minSize = MARKER_SIZE_MIN
const maxSize = MARKER_SIZE_MAX
```

- [ ] **Step 4: Run existing tests**

```bash
pnpm test -- useMapMarkers
```
Expected: PASS — all existing tests still pass (they assert '#FF9800', '#4CAF50', '#19568E', '#757575' — the values are unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/composables/useMapMarkers.js
git commit -m "refactor: use constants for marker colors and size limits"
```

---

### Task 8: Update pages/index.vue to use map constants

**Files:**
- Modify: `src/pages/index.vue`

- [ ] **Step 1: Add import**

In `src/pages/index.vue`, after the existing imports (around line 53), add:

```js
import {
  MAP_CENTER,
  MAP_ZOOM_CITY,
  MAP_ZOOM_REGION,
  MAP_ZOOM_FARM,
  MAP_ZOOM_MAX,
  MAP_BOUNDS_PADDING,
  MAP_INITIAL_PAN_X,
  SEARCH_DEBOUNCE_MS,
} from '@/config/constants.js'
```

- [ ] **Step 2: Replace TAYABAS constant and hardcoded zoom levels**

Replace line 63 (`const TAYABAS = [13.9649, 121.5923]`):

```js
const TAYABAS = MAP_CENTER
```

Replace `setView(TAYABAS, 11)` (line 94) with:
```js
mapRef.value.setView(TAYABAS, MAP_ZOOM_REGION)
```

Replace `setView(TAYABAS, 13)` (line 99) with:
```js
mapRef.value.setView(TAYABAS, MAP_ZOOM_CITY)
```

Replace `mapRef.value.setZoom(16)` (line 107) with:
```js
mapRef.value.setZoom(MAP_ZOOM_FARM)
```

Replace `.setView(TAYABAS, 13)` in `onMounted` (line 141) with:
```js
.setView(TAYABAS, MAP_ZOOM_CITY)
```

Replace `map.panBy([-160, 0])` (line 143) with:
```js
map.panBy([MAP_INITIAL_PAN_X, 0])
```

Replace `maxZoom: 19` (line 147) with:
```js
maxZoom: MAP_ZOOM_MAX,
```

Replace `{ paddingTopLeft: [350, 50], paddingBottomRight: [50, 50] }` (line 177) with:
```js
{ paddingTopLeft: MAP_BOUNDS_PADDING.topLeft, paddingBottomRight: MAP_BOUNDS_PADDING.bottomRight }
```

Replace `map.panBy([-100, 0])` (line 178) — this is a secondary adjustment, keep as-is (it's a one-off layout tweak, not a domain constant).

Replace `debounceTimer = setTimeout(() => applyFilters(), 180)` (line 135) with:
```js
debounceTimer = setTimeout(() => applyFilters(), SEARCH_DEBOUNCE_MS)
```

- [ ] **Step 3: Verify the map page still works**

```bash
pnpm dev
```
Open the map page. Confirm markers load, zoom controls work, and breadcrumb navigation still zooms to the right levels.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.vue
git commit -m "refactor: use constants for map zoom levels, center, and debounce delay"
```

---

### Task 9: Update LeafletMap.vue to use constants

**Files:**
- Modify: `src/components/LeafletMap.vue`

- [ ] **Step 1: Read the current file**

Open `src/components/LeafletMap.vue` to confirm current line numbers and content.

- [ ] **Step 2: Add import**

Add after existing imports:

```js
import { MARKER_CIRCLE_RADIUS, MARKER_CIRCLE_WEIGHT } from '@/config/constants.js'
```

- [ ] **Step 3: Replace hardcoded values**

Replace both occurrences of `{ radius: 8, color: CHART_COLORS[0], weight: 2 }` with:

```js
{ radius: MARKER_CIRCLE_RADIUS, color: CHART_COLORS[0], weight: MARKER_CIRCLE_WEIGHT }
```

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/LeafletMap.vue
git commit -m "refactor: use constants for circle marker radius and weight"
```

---

### Task 10: Update useInsightData.js to use MP_SIZE_BUCKETS

**Files:**
- Modify: `src/composables/useInsightData.js`

- [ ] **Step 1: Add import**

In `src/composables/useInsightData.js`, add after existing imports:

```js
import { MP_SIZE_BUCKETS } from '@/config/constants.js'
```

- [ ] **Step 2: Replace inline buckets array in fetchSizeData**

In `fetchSizeData` (around lines 74–80), replace:

```js
const buckets = [
  { label: '1-20 µm',      min: 1,    max: 20   },
  { label: '20-100 µm',    min: 20,   max: 100  },
  { label: '100-500 µm',   min: 100,  max: 500  },
  { label: '500 µm-1 mm',  min: 500,  max: 1000 },
  { label: '1-5 mm',       min: 1000, max: 5000 },
]
```

with:

```js
const buckets = MP_SIZE_BUCKETS
```

- [ ] **Step 3: Run existing tests**

```bash
pnpm test -- useInsightData
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/composables/useInsightData.js
git commit -m "refactor: use shared MP_SIZE_BUCKETS constant in useInsightData"
```

---

### Task 11: Update insight/[farm_name].vue to use MP_SIZE_BUCKETS

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`

- [ ] **Step 1: Add import**

In `src/pages/insight/[farm_name].vue`, add to the existing import from `@/config/chartPalette.js` section (line 186):

```js
import { MP_SIZE_BUCKETS } from '@/config/constants.js'
```

- [ ] **Step 2: Replace inline sizeBuckets array in fetchSizeComparisonForFarm**

In `fetchSizeComparisonForFarm` (around lines 464–470), replace:

```js
const sizeBuckets = [
  { label: '1-20 µm', min: 1, max: 20 },
  { label: '20-100 µm', min: 20, max: 100 },
  { label: '100-500 µm', min: 100, max: 500 },
  { label: '500 µm-1 mm', min: 500, max: 1000 },
  { label: '1-5 mm', min: 1000, max: 5000 },
]
```

with:

```js
const sizeBuckets = MP_SIZE_BUCKETS
```

- [ ] **Step 3: Verify the farm detail page loads**

```bash
pnpm dev
```
Navigate to a farm detail page. Confirm the size range chart still renders correctly.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/insight/\[farm_name\].vue
git commit -m "refactor: use shared MP_SIZE_BUCKETS constant in farm detail page"
```

---

### Task 12: Update router/index.js to use MOBILE_BREAKPOINT_PX

**Files:**
- Modify: `src/router/index.js`

- [ ] **Step 1: Read the relevant section**

Open `src/router/index.js` and find the `matchMedia('(max-width: 900px)')` usage (line 16).

- [ ] **Step 2: Add import**

Add at the top of `src/router/index.js`:

```js
import { MOBILE_BREAKPOINT_PX } from '@/config/constants.js'
```

- [ ] **Step 3: Replace the hardcoded value**

Replace:
```js
return window.matchMedia('(max-width: 900px)').matches
```
with:
```js
return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
```

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/router/index.js
git commit -m "refactor: use MOBILE_BREAKPOINT_PX constant in router guard"
```

---

## Priority E — Accessibility

---

### Task 13: Fix keyboard-inaccessible interactive elements

**Files:**
- Modify: `src/pages/insight/index.vue`
- Modify: `src/pages/insight/[farm_name].vue`

Currently, `<VIcon @click="...">` renders as a `<i>` element which is not reachable by keyboard. The print "button" is a `<div>` with `@click`. Neither accepts focus or keyboard events.

- [ ] **Step 1: Fix back button in insight/index.vue (line 71)**

Replace:
```html
<VIcon color="grey" size="x-large" style="cursor:pointer; vertical-align:middle;" @click="$router.back()">
  mdi-menu-left</VIcon>
```
with:
```html
<VBtn
  icon
  variant="text"
  color="grey"
  aria-label="Go back"
  @click="$router.back()"
>
  <VIcon size="x-large">mdi-menu-left</VIcon>
</VBtn>
```

- [ ] **Step 2: Fix print button in insight/index.vue (lines 88–91)**

Replace:
```html
<div class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
  style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
  <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
  <p class="text-h4 text-white font-weight-bold">Print Report</p>
</div>
```
with:
```html
<div
  class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
  style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);"
  role="button"
  tabindex="0"
  aria-label="Print report"
  @click="printReport"
  @keydown.enter="printReport"
  @keydown.space.prevent="printReport"
>
  <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
  <p class="text-h4 text-white font-weight-bold">Print Report</p>
</div>
```

- [ ] **Step 3: Fix back button in insight/[farm_name].vue (line 536)**

Replace:
```html
<VIcon color="grey" size="x-large" style="cursor:pointer; vertical-align:middle;" @click="$router.back()">
  mdi-menu-left</VIcon>
```
with:
```html
<VBtn
  icon
  variant="text"
  color="grey"
  aria-label="Go back"
  @click="$router.back()"
>
  <VIcon size="x-large">mdi-menu-left</VIcon>
</VBtn>
```

- [ ] **Step 4: Fix print button in insight/[farm_name].vue (lines 542–545)**

Replace:
```html
<div class="d-flex align-center justify-center bg-blue pa-4 px-6 rounded-lg cursor-pointer"
  style=" box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
  <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
  <p class="text-h4 text-white font-weight-bold">Print Report</p>
</div>
```
with:
```html
<div
  class="d-flex align-center justify-center bg-blue pa-4 px-6 rounded-lg cursor-pointer"
  style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);"
  role="button"
  tabindex="0"
  aria-label="Print report"
  @click="printReport"
  @keydown.enter="printReport"
  @keydown.space.prevent="printReport"
>
  <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
  <p class="text-h4 text-white font-weight-bold">Print Report</p>
</div>
```

- [ ] **Step 5: Verify keyboard navigation manually**

```bash
pnpm dev
```
Open insight page. Press Tab to focus the back button. Press Enter — should navigate back. Tab to the Print Report button. Press Enter — should trigger print dialog.

- [ ] **Step 6: Commit**

```bash
git add src/pages/insight/index.vue src/pages/insight/\[farm_name\].vue
git commit -m "fix: make back and print buttons keyboard accessible"
```

---

### Task 14: Add keyboard accessibility to map breadcrumb links

**Files:**
- Modify: `src/pages/index.vue`

The breadcrumb `<span>` elements use `@click` but are not in the tab order and have no keyboard event handler.

- [ ] **Step 1: Fix the breadcrumb region span**

In `src/pages/index.vue` (line 9), replace:

```html
<span class="breadcrumb-region breadcrumb-link" @click="gotoRegion">{{ regionName }}</span>
```
with:
```html
<span
  class="breadcrumb-region breadcrumb-link"
  role="button"
  tabindex="0"
  :aria-label="`Zoom to ${regionName}`"
  @click="gotoRegion"
  @keydown.enter="gotoRegion"
  @keydown.space.prevent="gotoRegion"
>{{ regionName }}</span>
```

- [ ] **Step 2: Fix the breadcrumb city span**

Replace:
```html
<span class="breadcrumb-city breadcrumb-link" @click="gotoCity">{{ cityName }}</span>
```
with:
```html
<span
  class="breadcrumb-city breadcrumb-link"
  role="button"
  tabindex="0"
  :aria-label="`Zoom to ${cityName}`"
  @click="gotoCity"
  @keydown.enter="gotoCity"
  @keydown.space.prevent="gotoCity"
>{{ cityName }}</span>
```

- [ ] **Step 3: Fix the breadcrumb farm span**

Replace:
```html
<span class="breadcrumb-farm breadcrumb-link" @click="gotoFarm">{{ selectedItem.site_name }}</span>
```
with:
```html
<span
  class="breadcrumb-farm breadcrumb-link"
  role="button"
  tabindex="0"
  :aria-label="`Zoom to ${selectedItem.site_name}`"
  @click="gotoFarm"
  @keydown.enter="gotoFarm"
  @keydown.space.prevent="gotoFarm"
>{{ selectedItem.site_name }}</span>
```

- [ ] **Step 4: Verify keyboard navigation manually**

```bash
pnpm dev
```
Open map page. Press Tab until focus reaches the breadcrumb links. Press Enter on "Quezon Province" — map should zoom out to region level.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.vue
git commit -m "fix: add keyboard navigation to map breadcrumb links"
```

---

### Task 15: Add ARIA labels to map and chart containers

**Files:**
- Modify: `src/pages/index.vue`
- Modify: `src/pages/insight/index.vue`

- [ ] **Step 1: Add role and aria-label to map container**

In `src/pages/index.vue`, replace the map container div (line 37):

```html
<div id="map" />
```
with:
```html
<div
  id="map"
  role="application"
  aria-label="Interactive microplastic contamination map of Tayabas City, Quezon Province"
/>
```

- [ ] **Step 2: Add aria-label to chart section headings in insight/index.vue**

For the charts that lack headings (they're in `<div class="card">` wrappers), add `aria-label` to the enclosing card where the chart title is not already in an `<h3>`. The key ones missing labels are the donut chart card and the boxplot card.

In `src/pages/insight/index.vue`, find the `MPDonutChart` card (around line 134) and add `aria-label` to its wrapper:

```html
<div class="card" aria-label="Microplastic morphology distribution donut chart">
  <MPDonutChart ... />
</div>
```

Find the `SoilTrapEfficiencyBoxplot` card (around line 151) and add:

```html
<div class="card" aria-label="Soil trap efficiency boxplot chart">
  <SoilTrapEfficiencyBoxplot ... />
</div>
```

- [ ] **Step 3: Verify no visual regressions**

```bash
pnpm dev
```
Open both the map page and insight page. Verify everything looks the same.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.vue src/pages/insight/index.vue
git commit -m "fix: add ARIA labels to map container and unlabelled chart cards"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|---|---|
| C: API failures show meaningful feedback | Tasks 3, 4, 5 |
| C: Skeleton loaders during loading | Tasks 2, 3 (boneyard-js) |
| C: Error fallback UI components | Task 1 (ErrorBanner) |
| D: Magic numbers centralized | Tasks 6–12 |
| D: Size ranges shared between files | Tasks 10, 11 |
| D: Marker colors/sizes centralized | Tasks 7, 8 |
| D: Mobile breakpoint centralized | Task 12 |
| E: Maps lack ARIA labels | Tasks 14, 15 |
| E: Charts lack ARIA labels | Task 15 |
| E: Interactive controls lack keyboard nav | Tasks 13, 14 |

### No Placeholders Found
All steps contain actual code. ✓

### Type Consistency
- `MP_SIZE_BUCKETS` used in Tasks 10 and 11 with identical shape `{ label, min, max }` ✓
- `MARKER_COLOR_*` constants used in Task 7 match string values expected by existing tests ✓
- `ErrorBanner` `message` prop is `String` in both Tasks 1, 3, 4, 5 ✓
- `farmNotFound` ref set in Task 5 is a `Boolean`, used as `v-if="farmNotFound"` ✓
