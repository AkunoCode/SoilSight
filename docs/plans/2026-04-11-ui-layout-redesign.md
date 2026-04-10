# UI Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SoilSight's three main pages (map, insight overview, farm detail) with a Light & Clean visual system, a fixed left sidebar on the map page, and full mobile responsiveness across all pages.

**Architecture:** Apply global CSS custom properties + Vuetify theme overrides first (Task 1), then restructure the map page into a sidebar layout via a new `MapSidebar.vue` component (Tasks 2–3), then polish and mobilise the two insight pages (Tasks 4–5). Each task is independently deployable.

**Tech Stack:** Vue 3 + Vuetify 3 + Pinia · Vitest + happy-dom · pnpm · Leaflet (map) · ApexCharts (charts)

**Spec:** `docs/specs/2026-04-11-ui-layout-redesign.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/plugins/vuetify.js` | Modify | Add `soilsight` Vuetify theme with colour overrides |
| `src/styles/settings.scss` | Modify | Add CSS custom property tokens (`--ss-*`) |
| `src/layouts/default.vue` | Modify | Set page background to `#f8fafc` |
| `src/components/KPI.vue` | Modify | Update card style to match new design tokens |
| `src/components/MapSidebar.vue` | **Create** | Sidebar panel: breadcrumb, search/filter, preview data, farm list |
| `src/pages/index.vue` | Modify | Replace overlay + PreviewCard with `<MapSidebar>` + mobile drawer |
| `src/components/PreviewCard.vue` | **Delete** | Logic absorbed into `MapSidebar.vue` |
| `src/pages/insight/index.vue` | Modify | Sticky header + KPI bar + card polish + mobile breakpoints |
| `src/pages/insight/[farm_name].vue` | Modify | Sticky header + farm KPI bar + two-column layout + mobile |

---

## Task 1: Global Visual System

**Files:**
- Modify: `src/plugins/vuetify.js`
- Modify: `src/styles/settings.scss`
- Modify: `src/layouts/default.vue`
- Modify: `src/components/KPI.vue`

- [ ] **Step 1: Add Vuetify theme in `src/plugins/vuetify.js`**

Replace the entire file with:

```js
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

export default createVuetify({
  theme: {
    defaultTheme: 'soilsight',
    themes: {
      soilsight: {
        dark: false,
        colors: {
          background: '#f8fafc',
          surface: '#ffffff',
          primary: '#1d4ed8',
          'primary-lighten-5': '#dbeafe',
          error: '#dc2626',
        },
      },
    },
  },
})
```

- [ ] **Step 2: Add CSS custom properties in `src/styles/settings.scss`**

Replace the entire file with:

```scss
/**
 * src/styles/settings.scss
 *
 * Global CSS custom properties (design tokens) for SoilSight.
 * These are used in component <style> blocks via var(--ss-*).
 */

:root {
  --ss-bg: #f8fafc;
  --ss-surface: #ffffff;
  --ss-border: #e2e8f0;
  --ss-text-primary: #0f172a;
  --ss-text-secondary: #64748b;
  --ss-accent: #1d4ed8;
  --ss-accent-light: #dbeafe;
  --ss-danger: #dc2626;

  /* Card style */
  --ss-card-radius: 12px;
  --ss-card-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  --ss-card-border: 1px solid #e2e8f0;
}
```

- [ ] **Step 3: Set page background in `src/layouts/default.vue`**

Replace the entire file with:

```vue
<template>
  <div class="layout-root">
    <v-main>
      <router-view />
    </v-main>
    <LoadingOverlay />
  </div>
</template>

<script setup>
  import LoadingOverlay from '@/components/LoadingOverlay.vue'
</script>

<style>
.layout-root {
  min-height: 100vh;
  background: var(--ss-bg);
}
</style>
```

- [ ] **Step 4: Update `src/components/KPI.vue` to use new tokens**

Replace the entire file with:

```vue
<template>
  <div class="kpi-card">
    <div class="kpi-label">{{ title }}</div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="subtitle" class="kpi-sub">{{ subtitle }}</div>
  </div>
</template>

<script setup>
  defineProps({
    title: { type: String, default: '' },
    value: { type: [String, Number], default: '' },
    subtitle: { type: String, default: '' },
  })
</script>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  background: var(--ss-surface);
  border: var(--ss-card-border);
  border-radius: var(--ss-card-radius);
  box-shadow: var(--ss-card-shadow);
  padding: 16px 20px;
  min-height: 80px;
}

.kpi-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--ss-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1;
}

.kpi-sub {
  margin-top: 4px;
  font-size: 10px;
  color: var(--ss-text-secondary);
}
</style>
```

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
pnpm test
```

Expected: all existing tests pass (no component logic changed).

- [ ] **Step 6: Start dev server and verify visual tokens load**

```bash
pnpm dev
```

Open `http://localhost:3000`. The app background should be `#f8fafc` (very light grey, not pure white). KPI cards on the insight page should have a lighter, more refined look.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/vuetify.js src/styles/settings.scss src/layouts/default.vue src/components/KPI.vue
git commit -m "feat: add Light & Clean visual tokens — Vuetify theme + CSS custom properties"
```

---

## Task 2: MapSidebar Component

**Files:**
- Create: `src/components/MapSidebar.vue`

This component is the fixed left panel on the map page. It receives farm data as props and emits navigation/filter events upward. It has no knowledge of the Leaflet map.

- [ ] **Step 1: Create `src/components/MapSidebar.vue`**

```vue
<template>
  <aside class="map-sidebar">
    <!-- Brand header -->
    <div class="sidebar-header">
      <p class="sidebar-eyebrow">Plastic Contamination Map</p>
      <h1 class="sidebar-title">{{ cityName }}</h1>
      <nav class="breadcrumb" aria-label="Location breadcrumb">
        <button class="breadcrumb-link" @click="$emit('goto-region')">{{ regionName }}</button>
        <span class="breadcrumb-sep" aria-hidden="true"> › </span>
        <button class="breadcrumb-link breadcrumb-active" @click="$emit('goto-city')">{{ cityName }}</button>
        <template v-if="selectedItem">
          <span class="breadcrumb-sep" aria-hidden="true"> › </span>
          <button class="breadcrumb-link breadcrumb-active" @click="$emit('goto-farm')">
            {{ selectedItem.site_name }}
          </button>
        </template>
      </nav>
    </div>

    <!-- Search + Filter -->
    <div class="sidebar-controls">
      <v-text-field
        :model-value="searchText"
        append-inner-icon="mdi-magnify"
        clearable
        density="compact"
        hide-details
        placeholder="Search farms..."
        variant="outlined"
        @update:model-value="$emit('update:searchText', $event)"
      />
      <v-select
        :model-value="selectedCategory"
        clearable
        density="compact"
        hide-details
        :items="categories"
        placeholder="Filter by practice"
        variant="outlined"
        class="mt-2"
        @update:model-value="$emit('update:selectedCategory', $event)"
      />
    </div>

    <!-- Preview panel -->
    <div class="sidebar-preview">
      <p class="preview-title">{{ displayTitle }}</p>
      <p class="preview-subtitle">{{ displaySubtitle }}</p>

      <!-- Compact donut -->
      <div class="donut-wrap">
        <MPDonutChart
          :active-key="app.selectedMorphology"
          :colors="mpColors"
          :labels-map="labelsMap"
          :microplastic-data="microplasticData"
          @selection="onDonutSelection"
        />
      </div>

      <!-- KPI pills -->
      <div class="kpi-pills">
        <div class="kpi-pill">
          <span class="kpi-pill-label">Avg Contamination</span>
          <span class="kpi-pill-value accent">{{ avgContamination }} MP/kg</span>
        </div>
        <div class="kpi-pill">
          <span class="kpi-pill-label">Dominant Type</span>
          <span class="kpi-pill-value">{{ dominantType }}</span>
        </div>
      </div>

      <!-- CTA -->
      <button class="cta-btn" @click="$emit('expand-insight')">
        View Full Insight Report →
      </button>
    </div>

    <!-- Farm list -->
    <div class="sidebar-list">
      <p class="list-heading">Sampled Farms</p>
      <SampledFarms :sampled-sites="allFarmsData" :show-map="false" />
    </div>
  </aside>
</template>

<script setup>
  import { computed } from 'vue'
  import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
  import SampledFarms from '@/components/SampledFarms.vue'
  import { MP_COLOR_MAP } from '@/config/chartPalette.js'
  import { useAppStore } from '@/stores/app'

  const props = defineProps({
    selectedItem: { type: Object, default: null },
    allFarmsData: { type: Array, default: () => [] },
    searchText: { type: String, default: '' },
    selectedCategory: { type: String, default: null },
    categories: { type: Array, default: () => [] },
    regionName: { type: String, default: 'Quezon Province' },
    cityName: { type: String, default: 'Tayabas City' },
  })

  defineEmits([
    'update:searchText',
    'update:selectedCategory',
    'expand-insight',
    'goto-region',
    'goto-city',
    'goto-farm',
  ])

  const app = useAppStore()
  const mpColors = { ...MP_COLOR_MAP }
  const labelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }

  const overviewTotals = computed(() => {
    const farms = props.allFarmsData
    if (farms.length === 0) return { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 }
    return farms.reduce((acc, f) => {
      acc.fragments += Number(f.fragment_count) || 0
      acc.fibers += Number(f.fiber_count) || 0
      acc.foams += Number(f.foam_count) || 0
      acc.films += Number(f.film_count) || 0
      acc.sheets += Number(f.sheets_count || f.sheet_count || f.sheets) || 0
      return acc
    }, { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 })
  })

  const microplasticData = computed(() => {
    if (!props.selectedItem) return overviewTotals.value
    const f = props.selectedItem
    return {
      fragments: Number(f.fragment_count) || 0,
      fibers: Number(f.fiber_count) || 0,
      foams: Number(f.foam_count) || 0,
      films: Number(f.film_count) || 0,
      sheets: Number(f.sheets_count || f.sheet_count || f.sheets) || 0,
    }
  })

  const displayTitle = computed(() =>
    props.selectedItem ? (props.selectedItem.site_name || 'Farm Site') : props.cityName,
  )

  const displaySubtitle = computed(() => {
    if (props.selectedItem) {
      return `Owner: ${props.selectedItem.owner || 'Unknown'} | ${props.selectedItem.cultivation_practice || 'Unknown Practice'}`
    }
    const count = props.allFarmsData.length
    const area = props.allFarmsData.reduce((s, f) => s + (f.land_area_ha || 0), 0)
    return count > 0 ? `${count} Farms · ${area.toFixed(1)} ha total` : 'Microplastic Analysis Overview'
  })

  const avgContamination = computed(() => {
    const farms = props.selectedItem ? [props.selectedItem] : props.allFarmsData
    if (farms.length === 0) return '—'
    const totals = farms.map(f =>
      (Number(f.fragment_count) || 0)
      + (Number(f.fiber_count) || 0)
      + (Number(f.foam_count) || 0)
      + (Number(f.film_count) || 0)
      + (Number(f.sheets_count || f.sheet_count || f.sheets) || 0),
    )
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length
    return avg >= 1000
      ? `${(avg / 1000).toFixed(1)}K`
      : Math.round(avg).toString()
  })

  const dominantType = computed(() => {
    const d = microplasticData.value
    const entries = Object.entries(d)
    if (entries.length === 0) return '—'
    const [key] = entries.reduce((max, curr) => curr[1] > max[1] ? curr : max)
    return labelsMap[key] || key
  })

  function onDonutSelection (key) {
    try { app.setSelectedMorphology(key) } catch { /* ignore */ }
  }
</script>

<style scoped>
.map-sidebar {
  width: 320px;
  min-width: 320px;
  height: 100vh;
  background: var(--ss-surface);
  border-right: var(--ss-card-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex-shrink: 0;
  z-index: 10;
}

.map-sidebar::-webkit-scrollbar { display: none; }

/* Header */
.sidebar-header {
  padding: 20px 20px 14px;
  border-bottom: var(--ss-card-border);
}

.sidebar-eyebrow {
  font-size: 11px;
  font-weight: 500;
  color: var(--ss-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 4px;
}

.sidebar-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1.1;
  margin: 0 0 6px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.breadcrumb-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--ss-text-secondary);
  font-family: inherit;
}

.breadcrumb-link:hover { color: var(--ss-accent); text-decoration: underline; }
.breadcrumb-active { font-weight: 600; color: var(--ss-text-primary); }
.breadcrumb-sep { font-size: 13px; color: var(--ss-text-secondary); padding: 0 2px; }

/* Controls */
.sidebar-controls {
  padding: 12px 16px;
  border-bottom: var(--ss-card-border);
}

/* Preview */
.sidebar-preview {
  padding: 16px;
  border-bottom: var(--ss-card-border);
}

.preview-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ss-text-primary);
  margin: 0 0 2px;
}

.preview-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0 0 12px;
}

.donut-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.kpi-pills {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.kpi-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--ss-bg);
  border: var(--ss-card-border);
  border-radius: 8px;
  padding: 8px 12px;
}

.kpi-pill-label {
  font-size: 11px;
  color: var(--ss-text-secondary);
}

.kpi-pill-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--ss-text-primary);
}

.kpi-pill-value.accent { color: var(--ss-accent); }

.cta-btn {
  width: 100%;
  background: var(--ss-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.cta-btn:hover { background: #1e40af; }

/* Farm list */
.sidebar-list {
  padding: 16px;
  flex: 1;
}

.list-heading {
  font-size: 11px;
  font-weight: 500;
  color: var(--ss-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin: 0 0 8px;
}
</style>
```

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: all tests pass (new component has no logic to test yet beyond props).

- [ ] **Step 3: Commit**

```bash
git add src/components/MapSidebar.vue
git commit -m "feat: add MapSidebar component — sidebar panel for map page"
```

---

## Task 3: Map Page Restructure (`index.vue`)

**Files:**
- Modify: `src/pages/index.vue`
- Delete: `src/components/PreviewCard.vue`

The map page layout changes from a fullscreen map with floating overlays to a flex row: fixed sidebar (320px) + map filling the rest. Mobile adds a `v-navigation-drawer` + bottom peek drawer.

- [ ] **Step 1: Rewrite `src/pages/index.vue`**

Replace the entire file with:

```vue
<template>
  <v-app>
    <v-main class="map-page">

      <!-- Mobile: temporary navigation drawer (hamburger opens this) -->
      <v-navigation-drawer
        v-model="mobileDrawerOpen"
        location="left"
        temporary
        width="320"
        class="d-md-none"
      >
        <MapSidebar
          :all-farms-data="allFarmsData"
          :categories="categories"
          :city-name="cityName"
          :region-name="regionName"
          :search-text="searchText"
          :selected-category="selectedCategory"
          :selected-item="selectedItem"
          @expand-insight="expandInsight"
          @goto-city="gotoCity"
          @goto-farm="gotoFarm"
          @goto-region="gotoRegion"
          @update:search-text="searchText = $event"
          @update:selected-category="selectedCategory = $event"
        />
      </v-navigation-drawer>

      <!-- Desktop: fixed sidebar -->
      <div class="map-layout">
        <div class="sidebar-desktop d-none d-md-flex">
          <MapSidebar
            :all-farms-data="allFarmsData"
            :categories="categories"
            :city-name="cityName"
            :region-name="regionName"
            :search-text="searchText"
            :selected-category="selectedCategory"
            :selected-item="selectedItem"
            @expand-insight="expandInsight"
            @goto-city="gotoCity"
            @goto-farm="gotoFarm"
            @goto-region="gotoRegion"
            @update:search-text="searchText = $event"
            @update:selected-category="selectedCategory = $event"
          />
        </div>

        <!-- Map fills remaining area -->
        <div
          id="map"
          aria-label="Interactive microplastic contamination map of Tayabas City, Quezon Province"
          class="map-canvas"
          role="application"
        />

        <!-- Mobile top bar (hamburger + search) -->
        <div class="mobile-topbar d-flex d-md-none">
          <button class="hamburger-btn" aria-label="Open menu" @click="mobileDrawerOpen = true">
            <v-icon>mdi-menu</v-icon>
          </button>
          <v-text-field
            v-model="searchText"
            append-inner-icon="mdi-magnify"
            clearable
            density="compact"
            hide-details
            placeholder="Search farms..."
            variant="outlined"
            class="mobile-search"
          />
        </div>

        <!-- Mobile bottom peek drawer -->
        <div
          class="mobile-peek d-flex d-md-none"
          :style="{ transform: `translateY(${mobilePeekOffset}px)` }"
          @touchstart="onPeekTouchStart"
          @touchmove="onPeekTouchMove"
          @touchend="onPeekTouchEnd"
        >
          <div class="peek-handle-bar" />
          <p class="peek-title">{{ selectedItem ? selectedItem.site_name : cityName }}</p>
          <p class="peek-subtitle">{{ selectedItem
            ? `${selectedItem.cultivation_practice || ''}`
            : `${allFarmsData.length} Farms` }}</p>
          <div class="peek-kpis">
            <div class="peek-kpi">
              <span class="peek-kpi-label">Avg MP/kg</span>
              <span class="peek-kpi-value">{{ mobilePeekAvg }}</span>
            </div>
            <div class="peek-kpi">
              <span class="peek-kpi-label">Dominant</span>
              <span class="peek-kpi-value">{{ mobilePeekDominant }}</span>
            </div>
          </div>
          <button class="peek-cta" @click="expandInsight">View Full Report →</button>
        </div>
      </div>

      <!-- Error snackbar -->
      <VSnackbar
        v-model="dataError"
        color="warning"
        location="top"
        timeout="8000"
      >
        {{ dataErrorMsg }}
        <template #actions>
          <VBtn variant="text" @click="dataError = false">Dismiss</VBtn>
        </template>
      </VSnackbar>
    </v-main>
  </v-app>
</template>

<script setup>
  import { readItems } from '@directus/sdk'
  import L from 'leaflet'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import tayabasGeoRaw from '@/assets/geojson/Tayabas.geojson?raw'
  import MapSidebar from '@/components/MapSidebar.vue'
  import directus from '@/composables/useDirectus'
  import { useMapMarkers } from '@/composables/useMapMarkers.js'
  import { CHART_COLORS } from '@/config/chartPalette'
  import {
    MAP_BOUNDS_PADDING,
    MAP_CENTER,
    MAP_INITIAL_PAN_X,
    MAP_ZOOM_CITY,
    MAP_ZOOM_FARM,
    MAP_ZOOM_MAX,
    MAP_ZOOM_REGION,
    SEARCH_DEBOUNCE_MS,
  } from '@/config/constants.js'
  import { useAppStore } from '@/stores/app'
  import 'leaflet/dist/leaflet.css'

  const tayabasGeo = JSON.parse(tayabasGeoRaw)
  const router = useRouter()

  const selectedItem = ref(null)
  const allFarmsData = ref([])
  const searchText = ref('')
  const selectedCategory = ref(null)
  const regionName = ref('Quezon Province')
  const cityName = ref('Tayabas City')
  const TAYABAS = MAP_CENTER
  const mapRef = ref(null)
  const mobileDrawerOpen = ref(false)
  let debounceTimer = null
  const dataError = ref(false)
  const dataErrorMsg = ref('')

  // Mobile peek drawer drag state
  const PEEK_COLLAPSED = 0    // translateY(0) = peeking at bottom
  const PEEK_EXPANDED = -340  // expanded upward showing more content
  const mobilePeekOffset = ref(PEEK_COLLAPSED)
  let peekDragStartY = 0
  let peekDragStartOffset = 0

  function onPeekTouchStart (e) {
    peekDragStartY = e.touches[0].clientY
    peekDragStartOffset = mobilePeekOffset.value
  }

  function onPeekTouchMove (e) {
    const delta = e.touches[0].clientY - peekDragStartY
    const next = peekDragStartOffset + delta
    mobilePeekOffset.value = Math.max(PEEK_EXPANDED, Math.min(PEEK_COLLAPSED, next))
  }

  function onPeekTouchEnd () {
    const mid = (PEEK_EXPANDED + PEEK_COLLAPSED) / 2
    mobilePeekOffset.value = mobilePeekOffset.value <= mid ? PEEK_EXPANDED : PEEK_COLLAPSED
  }

  const { addMarkers, getMarkerColor } = useMapMarkers(allFarmsData, mapRef)

  const categories = computed(() => {
    const set = new Set()
    for (const i of allFarmsData.value) {
      if (i.cultivation_practice) set.add(i.cultivation_practice)
    }
    return Array.from(set)
  })

  // Computed for mobile peek — mirrors MapSidebar logic
  const mobilePeekAvg = computed(() => {
    const farms = selectedItem.value ? [selectedItem.value] : allFarmsData.value
    if (!farms.length) return '—'
    const totals = farms.map(f =>
      (Number(f.fragment_count) || 0) + (Number(f.fiber_count) || 0)
      + (Number(f.foam_count) || 0) + (Number(f.film_count) || 0)
      + (Number(f.sheets_count || f.sheet_count || f.sheets) || 0),
    )
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length
    return avg >= 1000 ? `${(avg / 1000).toFixed(1)}K` : Math.round(avg).toString()
  })

  const mobilePeekDominant = computed(() => {
    const farm = selectedItem.value
    const source = farm
      ? { fragments: farm.fragment_count, fibers: farm.fiber_count, foams: farm.foam_count, films: farm.film_count, sheets: farm.sheets_count || farm.sheet_count || farm.sheets }
      : allFarmsData.value.reduce((acc, f) => {
        acc.fragments = (acc.fragments || 0) + (Number(f.fragment_count) || 0)
        acc.fibers = (acc.fibers || 0) + (Number(f.fiber_count) || 0)
        acc.foams = (acc.foams || 0) + (Number(f.foam_count) || 0)
        acc.films = (acc.films || 0) + (Number(f.film_count) || 0)
        acc.sheets = (acc.sheets || 0) + (Number(f.sheets_count || f.sheet_count || f.sheets) || 0)
        return acc
      }, {})
    const map = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }
    const [key] = Object.entries(source).reduce((a, b) => (Number(b[1]) || 0) > (Number(a[1]) || 0) ? b : a, ['', 0])
    return map[key] || '—'
  })

  async function fetchDataFromDirectus () {
    try {
      const res = await directus.request(readItems('sites'))
      const items = Array.isArray(res) ? res : (res?.data || [])
      allFarmsData.value = items
      return items
    } catch (error) {
      console.error('Error fetching farms data from Directus:', error)
      dataErrorMsg.value = error?.message || 'Failed to load farm data. Check your connection.'
      dataError.value = true
      throw error
    }
  }

  function resetToOverview () {
    selectedItem.value = null
  }

  function gotoRegion () {
    resetToOverview()
    if (mapRef.value) mapRef.value.setView(TAYABAS, MAP_ZOOM_REGION)
  }

  function gotoCity () {
    resetToOverview()
    if (mapRef.value) mapRef.value.setView(TAYABAS, MAP_ZOOM_CITY)
  }

  function gotoFarm () {
    if (!selectedItem.value || !mapRef.value) return
    const item = selectedItem.value
    if (item.latitude && item.longitude) {
      mapRef.value.panTo([item.latitude, item.longitude])
      mapRef.value.setZoom(MAP_ZOOM_FARM)
    }
  }

  function expandInsight () {
    if (!selectedItem.value) {
      router.push('/insight/')
    } else if (selectedItem.value.site_name) {
      router.push(`/insight/${encodeURIComponent(selectedItem.value.site_name)}`)
    }
  }

  function applyFilters () {
    const q = (searchText.value || '').toLowerCase().trim()
    const cat = selectedCategory.value || 'All'
    const items = Array.isArray(allFarmsData.value) ? allFarmsData.value : []
    const filtered = items.filter(item => {
      if (cat && cat !== 'All' && item.cultivation_practice !== cat) return false
      if (!q) return true
      return (item.site_name || '').toLowerCase().includes(q)
    })
    addMarkers(filtered.filter(i => i.latitude && i.longitude))
  }

  watch([searchText, selectedCategory], () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(applyFilters, SEARCH_DEBOUNCE_MS)
  })

  onMounted(async () => {
    const app = useAppStore()
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const map = L.map('map', { zoomControl: false }).setView(TAYABAS, MAP_ZOOM_CITY)
      mapRef.value = map
      setTimeout(() => map.panBy([MAP_INITIAL_PAN_X, 0]), 100)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
        maxZoom: MAP_ZOOM_MAX,
      }).addTo(map)

      map.on('click', resetToOverview)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      const legend = L.control({ position: 'bottomright' })
      legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend-box')
        L.DomEvent.disableClickPropagation(div)
        const entries = [
          { label: 'Integrated', color: getMarkerColor('integrated') },
          { label: 'Organic', color: getMarkerColor('organic') },
          { label: 'Conventional', color: getMarkerColor('conventional') },
          { label: 'Other', color: getMarkerColor('other') },
        ]
        div.innerHTML = entries.map(e =>
          `<div class="legend-entry"><span class="legend-swatch" style="background:${e.color}"></span><span class="legend-label">${e.label}</span></div>`,
        ).join('')
        return div
      }
      legend.addTo(map)

      try {
        const geoLayer = L.geoJSON(tayabasGeo, {
          style: { color: CHART_COLORS[0], weight: 3, dashArray: '5, 5', fillColor: CHART_COLORS[0], fillOpacity: 0.1 },
          interactive: false,
        }).addTo(map)
        map.fitBounds(geoLayer.getBounds(), { paddingTopLeft: MAP_BOUNDS_PADDING.topLeft, paddingBottomRight: MAP_BOUNDS_PADDING.bottomRight })
        setTimeout(() => map.panBy([-100, 0]), 200)
      } catch (geoError) {
        console.error('Error adding GeoJSON:', geoError)
      }

      try {
        app.startLoading()
        const items = await fetchDataFromDirectus()
        allFarmsData.value = items
        applyFilters()
      } catch {
        console.error('Error loading marker data')
      } finally {
        try { app.finishLoading() } catch { /* ignore */ }
      }

      setTimeout(() => map.invalidateSize(), 100)
    } catch (error) {
      console.error('Error initializing map:', error)
    }
  })
</script>

<style>
/* Map canvas */
.map-page {
  padding: 0 !important;
}

.map-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
}

.sidebar-desktop {
  flex-shrink: 0;
}

#map, .map-canvas {
  flex: 1;
  height: 100vh;
  background-color: #e8eef3;
}

/* Mobile top bar */
.mobile-topbar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 500;
  gap: 8px;
  align-items: center;
}

.hamburger-btn {
  background: white;
  border: 1px solid var(--ss-border);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.mobile-search {
  flex: 1;
  background: white;
  border-radius: 8px;
}

/* Mobile peek drawer */
.mobile-peek {
  position: absolute;
  bottom: -180px; /* hides most of it; translateY brings it up */
  left: 0;
  right: 0;
  background: var(--ss-surface);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
  padding: 12px 16px 200px; /* extra bottom padding to account for hidden area */
  z-index: 500;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: none;
}

.peek-handle-bar {
  width: 36px;
  height: 4px;
  background: var(--ss-border);
  border-radius: 2px;
  margin: 0 auto 12px;
}

.peek-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ss-text-primary);
  margin: 0 0 2px;
}

.peek-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0 0 10px;
}

.peek-kpis {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.peek-kpi {
  flex: 1;
  background: var(--ss-bg);
  border: var(--ss-card-border);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: center;
}

.peek-kpi-label {
  display: block;
  font-size: 10px;
  color: var(--ss-text-secondary);
  margin-bottom: 2px;
}

.peek-kpi-value {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: var(--ss-accent);
}

.peek-cta {
  width: 100%;
  background: var(--ss-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

/* Legend (Leaflet-rendered) */
.legend-box {
  background: white;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  font-size: 14px;
  line-height: 1.3;
  pointer-events: auto;
  min-width: 160px;
}

.legend-entry {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-entry:last-child { margin-bottom: 0; }

.legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
}

.legend-label {
  color: #222;
  font-weight: 500;
}

.leaflet-bottom.leaflet-right {
  right: 1.5rem !important;
}
</style>
```

- [ ] **Step 2: Delete `src/components/PreviewCard.vue`**

```bash
rm src/components/PreviewCard.vue
```

- [ ] **Step 3: Verify no remaining imports of PreviewCard**

```bash
grep -r "PreviewCard" src/
```

Expected: no output (nothing imports it anymore).

- [ ] **Step 4: Run dev server and verify map page**

```bash
pnpm dev
```

Visit `http://localhost:3000`. Verify:
- Desktop (≥ 960px wide): sidebar visible on left, map fills the right
- Mobile (≤ 600px): map fills screen, hamburger button top-left, bottom peek drawer visible
- Clicking a map marker selects the farm and sidebar updates
- Search and filter in sidebar update map markers
- "View Full Insight Report" button navigates to `/insight/`

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.vue src/components/MapSidebar.vue
git rm src/components/PreviewCard.vue
git commit -m "feat: replace PreviewCard overlay with fixed MapSidebar + mobile bottom drawer"
```

---

## Task 4: Insight Dashboard (`src/pages/insight/index.vue`)

**Files:**
- Modify: `src/pages/insight/index.vue`

Add a sticky page header + KPI bar, wrap existing charts in the new card style, and add Vuetify responsive column props for mobile.

- [ ] **Step 1: Replace the `<template>` block in `src/pages/insight/index.vue`**

Find the opening `<template>` tag and replace everything from `<template>` to `</template>` (the full template block) with:

```vue
<template>
  <div class="insight-page">

    <!-- Sticky page header -->
    <header class="page-header">
      <div class="header-left">
        <VBtn
          aria-label="Go back"
          color="grey"
          icon
          variant="text"
          @click="$router.back()"
        >
          <VIcon size="x-large">mdi-menu-left</VIcon>
        </VBtn>
        <div>
          <h1 class="header-title">Tayabas City</h1>
          <p class="header-subtitle">Quezon Province, Philippines</p>
        </div>
      </div>
      <VBtn
        class="print-btn d-none d-sm-flex"
        color="primary"
        prepend-icon="mdi-note-text-outline"
        rounded="lg"
        @click="printReport"
      >
        Print Report
      </VBtn>
    </header>

    <!-- Sticky KPI bar -->
    <div class="kpi-bar">
      <VSkeletonLoader v-if="loading" class="kpi-bar-skeleton" type="text@4" />
      <template v-else>
        <div class="kpi-bar-item">
          <span class="kpi-bar-label">Sites Sampled</span>
          <span class="kpi-bar-value">{{ sites.length }} Farms</span>
          <span class="kpi-bar-sub">Within Tayabas, Quezon</span>
        </div>
        <div class="kpi-bar-divider d-none d-md-block" />
        <div class="kpi-bar-item">
          <span class="kpi-bar-label">Avg Contamination</span>
          <span class="kpi-bar-value accent">{{ avgContaminationDensity }} MP/kg</span>
          <span class="kpi-bar-sub">Across all sites</span>
        </div>
        <div class="kpi-bar-divider d-none d-md-block" />
        <div class="kpi-bar-item">
          <span class="kpi-bar-label">Dominant Pollutant</span>
          <span class="kpi-bar-value">{{ dominantPollutant }}</span>
          <span class="kpi-bar-sub">Among 5 shapes detected</span>
        </div>
        <div class="kpi-bar-divider d-none d-md-block" />
        <div class="kpi-bar-item">
          <span class="kpi-bar-label">Highest Risk Site</span>
          <span class="kpi-bar-value danger">{{ highestRiskSite.name }} Farm</span>
          <span class="kpi-bar-sub">{{ highestRiskSite.density }} MP</span>
        </div>
      </template>
    </div>

    <div class="page-content">
      <ErrorBanner
        v-if="error"
        :message="error?.message || 'Failed to load data. Please check your connection or try again.'"
        @retry="loadAll"
      />

      <!-- Row 1: AI Summary + Farm List -->
      <VRow class="mb-3">
        <VCol cols="12" md="8">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading" type="article" />
            <AISummary v-else />
          </div>
        </VCol>
        <VCol cols="12" md="4">
          <div class="ss-card ss-card--scroll">
            <VSkeletonLoader v-if="loading" type="heading, list-item-two-line" />
            <template v-else>
              <h3 class="card-title mb-2">Sampled Farms</h3>
              <SampledFarms :sampled-sites="sites" />
            </template>
          </div>
        </VCol>
      </VRow>

      <!-- Row 2: Practice bar + Heatmap + Degradation -->
      <VRow class="mb-3">
        <VCol cols="12" md="4">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading" height="400" type="image" />
            <MPPracticeBar
              v-else
              :filter-key="app.selectedMorphology"
              :height="400"
              :options="contaminationByPracticeOptions"
              :series="contaminationByPracticeSeries"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Contamination Comparison by Farm Practices"
            />
          </div>
        </VCol>
        <VCol cols="12" md="4">
          <div class="ss-card">
            <template v-if="loading">
              <VSkeletonLoader type="heading" />
              <VSkeletonLoader class="mt-2" height="400" type="image" />
            </template>
            <template v-else>
              <h3 class="card-title">Source Identification Heatmap</h3>
              <p class="card-subtitle mb-2">Microplastic Counts by Source and Plastic Type</p>
              <SourceIdentificationHeatmap height="400" :sites="sites" />
            </template>
          </div>
        </VCol>
        <VCol cols="12" md="4">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading" height="400" type="image" />
            <SourceDegradationIndex v-else height="400" :sites="sites" />
          </div>
        </VCol>
      </VRow>

      <!-- Row 3: Donut + Biological Risk -->
      <VRow class="mb-3">
        <VCol cols="12" md="7">
          <div class="ss-card" aria-label="Microplastic morphology distribution donut chart">
            <VSkeletonLoader v-if="loading" height="360" type="image" />
            <MPDonutChart
              v-else
              :active-key="app.selectedMorphology"
              :colors="donutColors"
              :labels-map="donutLabelsMap"
              :microplastic-data="microplasticData"
              @selection="handleLegendClick"
            />
          </div>
        </VCol>
        <VCol cols="12" md="5">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading" height="360" type="image" />
            <BiologicalRiskChart v-else :data="biologicalRiskData" height="360" />
          </div>
        </VCol>
      </VRow>

      <!-- Row 4: Size range all -->
      <VRow class="mb-3">
        <VCol cols="12">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading || colorComparisonLoading" height="400" type="image" />
            <MPSizeRangeAll
              v-else
              :filter-key="app.selectedMorphology"
              :height="400"
              :size-data="sizeComparisonAll"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Microplastic Size Distribution"
            />
          </div>
        </VCol>
      </VRow>

      <!-- Row 5: Site drilldown + Monthly trend -->
      <VRow class="mb-3">
        <VCol cols="12" md="6">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading || colorComparisonLoading" height="400" type="image" />
            <SiteDrilldownChart
              v-else
              :categories="siteCategories"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
              :colors="mpColors"
              :drilldown="siteDrilldown"
              :filter-key="app.selectedMorphology"
              :height="400"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Contamination by Site"
              :totals="siteTotals"
            />
          </div>
        </VCol>
        <VCol cols="12" md="6">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading" height="400" type="image" />
            <MonthlyTrendChart
              v-else
              :filter-key="app.selectedMorphology"
              :height="400"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Monthly Microplastic Trend"
            />
          </div>
        </VCol>
      </VRow>

      <!-- Row 6: Input totals + soil texture + farm size + top crops -->
      <VRow class="mb-3">
        <VCol cols="12" md="6">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading || colorComparisonLoading" height="360" type="image" />
            <SiteDrilldownChart
              v-else
              :categories="textures"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
              :colors="mpColors"
              :drilldown="textureDrilldown"
              :filter-key="app.selectedMorphology"
              :height="360"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Contamination by Soil Texture"
              :totals="textureTotals"
            />
          </div>
        </VCol>
        <VCol cols="12" md="6">
          <div class="ss-card">
            <VSkeletonLoader v-if="loading || colorComparisonLoading" height="360" type="image" />
            <SiteDrilldownChart
              v-else
              :categories="inputTotals.categories"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
              :colors="mpColors"
              :drilldown="inputDrilldown"
              :filter-key="app.selectedMorphology"
              :height="360"
              :subtitle="`Data as of ${displayLatestSampleDate}`"
              title="Contamination by Agricultural Input"
              :totals="inputTotals.totals"
            />
          </div>
        </VCol>
      </VRow>

    </div>
  </div>
</template>
```

- [ ] **Step 2: Add styles to the `<style>` block in `src/pages/insight/index.vue`**

Find the existing `<style>` block (or add one if absent) and replace it with:

```vue
<style scoped>
.insight-page {
  background: var(--ss-bg);
  min-height: 100vh;
}

/* Sticky header */
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--ss-surface);
  border-bottom: var(--ss-card-border);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1;
  margin: 0;
}

.header-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0;
}

/* KPI bar */
.kpi-bar {
  position: sticky;
  top: 57px; /* height of page-header */
  z-index: 19;
  background: var(--ss-surface);
  border-bottom: var(--ss-card-border);
  padding: 10px 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 959px) {
  .kpi-bar {
    grid-template-columns: repeat(2, 1fr);
    top: 57px;
  }
}

.kpi-bar-skeleton {
  grid-column: 1 / -1;
}

.kpi-bar-item {
  display: flex;
  flex-direction: column;
}

.kpi-bar-divider {
  width: 1px;
  background: var(--ss-border);
  align-self: stretch;
}

.kpi-bar-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--ss-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 2px;
}

.kpi-bar-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1;
}

.kpi-bar-value.accent { color: var(--ss-accent); }
.kpi-bar-value.danger { color: var(--ss-danger); }

.kpi-bar-sub {
  font-size: 10px;
  color: var(--ss-text-secondary);
  margin-top: 2px;
}

/* Content */
.page-content {
  padding: 20px 24px;
}

/* Cards */
.ss-card {
  background: var(--ss-surface);
  border: var(--ss-card-border);
  border-radius: var(--ss-card-radius);
  box-shadow: var(--ss-card-shadow);
  padding: 16px 20px;
  height: 100%;
}

.ss-card--scroll {
  max-height: 500px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ss-text-primary);
  margin: 0 0 2px;
}

.card-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0;
}

/* Print */
@media print {
  .page-header { position: static; }
  .kpi-bar { position: static; }
}
</style>
```

- [ ] **Step 3: Run dev server and verify insight page**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/insight/`. Verify:
- Sticky header stays at top while scrolling
- KPI bar is visible below header and sticks while scrolling
- All chart cards have white background, rounded corners, subtle border
- On mobile (DevTools responsive mode, < 960px): KPI bar shows 2×2 grid, chart columns stack to full width

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "feat: insight overview — sticky header + KPI bar + card polish + mobile breakpoints"
```

---

## Task 5: Farm Insight Page (`src/pages/insight/[farm_name].vue`)

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`

Add sticky header + farm-specific KPI bar. Restructure into a two-column layout on desktop (farm details + map on left/right, charts below). Single-column on mobile.

- [ ] **Step 1: Replace the `<template>` block in `src/pages/insight/[farm_name].vue`**

Find the full `<template>` block and replace it with:

```vue
<template>
  <div class="insight-page">
    <ErrorBanner
      v-if="farmNotFound"
      :message="`Farm '${farmParam}' could not be found. It may have been removed or the name is incorrect.`"
      @retry="$router.back()"
    />

    <template v-if="!farmNotFound">

      <!-- Sticky page header -->
      <header class="page-header">
        <div class="header-left">
          <VBtn aria-label="Go back" color="grey" icon variant="text" @click="$router.back()">
            <VIcon size="x-large">mdi-menu-left</VIcon>
          </VBtn>
          <div>
            <VSkeletonLoader v-if="!farm" type="heading" width="220" />
            <h1 v-else class="header-title">{{ farm.site_name }}</h1>
            <VSkeletonLoader v-if="!farm" class="mt-1" type="text" width="180" />
            <p v-else class="header-subtitle">
              Owner: {{ farm.owner || 'Unknown' }} | {{ titleCase(farm.cultivation_practice) }}
            </p>
          </div>
        </div>
        <VBtn
          class="print-btn d-none d-sm-flex"
          color="primary"
          prepend-icon="mdi-note-text-outline"
          rounded="lg"
          @click="printReport"
        >
          Print Report
        </VBtn>
      </header>

      <!-- Sticky farm KPI bar -->
      <div class="kpi-bar">
        <VSkeletonLoader v-if="!farm" class="kpi-bar-skeleton" type="text@4" />
        <template v-else>
          <div class="kpi-bar-item">
            <span class="kpi-bar-label">Total MP Count</span>
            <span class="kpi-bar-value">{{ farmTotalMP.toLocaleString() }}</span>
            <span class="kpi-bar-sub">All morphologies combined</span>
          </div>
          <div class="kpi-bar-divider d-none d-md-block" />
          <div class="kpi-bar-item">
            <span class="kpi-bar-label">Dominant Morphology</span>
            <span class="kpi-bar-value">{{ farmDominantMorphology }}</span>
            <span class="kpi-bar-sub">Most frequent type</span>
          </div>
          <div class="kpi-bar-divider d-none d-md-block" />
          <div class="kpi-bar-item">
            <span class="kpi-bar-label">Sample Date</span>
            <span class="kpi-bar-value">{{ displaySampleDate }}</span>
            <span class="kpi-bar-sub">Latest collection</span>
          </div>
          <div class="kpi-bar-divider d-none d-md-block" />
          <div class="kpi-bar-item">
            <span class="kpi-bar-label">Land Area</span>
            <span class="kpi-bar-value">{{ farm.land_area_ha ?? '—' }} ha</span>
            <span class="kpi-bar-sub">Farm size</span>
          </div>
        </template>
      </div>

      <div class="page-content">

        <!-- Row 1: Farm details + Mini map -->
        <VRow class="mb-3">
          <VCol cols="12" md="7">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm" type="article" />
              <template v-else>
                <h3 class="card-title mb-1">{{ titleCase(farm.cultivation_practice) }} Farming</h3>
                <p class="card-subtitle mb-3">{{ getCultivationDefinition(farm.cultivation_practice) }}</p>
                <div class="farm-meta-grid">
                  <div class="farm-meta-item">
                    <VIcon class="mr-1" size="small" color="primary">{{ waterIcon }}</VIcon>
                    <span class="farm-meta-label">Water Source</span>
                    <span class="farm-meta-value">{{ titleCase(farm.water_source) || '—' }}</span>
                  </div>
                  <div class="farm-meta-item">
                    <VIcon class="mr-1" size="small" color="primary">mdi-image-filter-hdr</VIcon>
                    <span class="farm-meta-label">Soil Texture</span>
                    <span class="farm-meta-value">{{ titleCase(farm.soil_type) || '—' }}</span>
                  </div>
                  <div class="farm-meta-item">
                    <VIcon class="mr-1" size="small" color="primary">mdi-sprout</VIcon>
                    <span class="farm-meta-label">Crops</span>
                    <span class="farm-meta-value">{{ titleCase((farm.crops || []).join(', ')) || '—' }}</span>
                  </div>
                </div>
                <div class="mt-3">
                  <p class="card-subtitle mb-2">Plastic-Related Activities</p>
                  <div v-for="activity in plasticActivityList" :key="activity" class="activity-row">
                    <span class="activity-name">{{ activity }}</span>
                    <VIcon :color="farmHasActivity(activity) ? 'success' : 'error'" size="small">
                      {{ farmHasActivity(activity) ? 'mdi-check-circle' : 'mdi-close-circle' }}
                    </VIcon>
                  </div>
                </div>
              </template>
            </div>
          </VCol>
          <VCol cols="12" md="5">
            <div class="ss-card map-card">
              <VSkeletonLoader v-if="!farm" height="100%" type="image" />
              <template v-else>
                <h3 class="card-title mb-2">Geographic Location</h3>
                <p class="card-subtitle mb-2">{{ farm.latitude }}, {{ farm.longitude }}</p>
                <div v-if="farm.latitude != null && farm.longitude != null" class="mini-map-wrap">
                  <LeafletMap :lat="Number(farm.latitude)" :lng="Number(farm.longitude)" :zoom="13" />
                </div>
                <p v-else class="card-subtitle">No coordinates available.</p>
              </template>
            </div>
          </VCol>
        </VRow>

        <!-- Row 2: AI Summary + Donut -->
        <VRow class="mb-3">
          <VCol cols="12" md="7">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm" type="article" />
              <AISummary v-else :is-overview="false" :item="farm" :show-generate="true" />
            </div>
          </VCol>
          <VCol cols="12" md="5">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm" height="300" type="image" />
              <MPDonutChart
                v-else
                :active-key="app.selectedMorphology"
                :date="displaySampleDate"
                :microplastic-data="microplasticData"
                @selection="handleDonutSelection"
              />
            </div>
          </VCol>
        </VRow>

        <!-- Row 3: Site drilldown + Size range -->
        <VRow class="mb-3">
          <VCol cols="12" md="6">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm || colorComparisonLoading" height="280" type="image" />
              <SiteDrilldownChart
                v-else
                :categories="anonymizedComparison.categories"
                :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
                :colors="mpColors"
                :date="displaySampleDate"
                :drilldown="anonymizedComparison.drilldown"
                :filter-key="app.selectedMorphology"
                :height="280"
                :title="farm.cultivation_practice
                  ? `Comparison to Other ${titleCase(farm.cultivation_practice)} Farms`
                  : 'Contamination Comparison'"
                :totals="anonymizedComparison.totals"
              />
            </div>
          </VCol>
          <VCol cols="12" md="6">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm || sizeComparisonLoading" height="280" type="image" />
              <MPSizeRangeChart
                v-else
                :categories="sizeComparisonData ? sizeComparisonData.categories : []"
                :date="displaySampleDate"
                :drilldown="sizeComparisonData ? sizeComparisonData.drilldown : []"
                :filter-key="app.selectedMorphology"
                :height="280"
                title="Microplastic Size Distribution"
                :totals="sizeComparisonData ? sizeComparisonData.totals : []"
              />
            </div>
          </VCol>
        </VRow>

        <!-- Row 4: Monthly trend + Biological risk -->
        <VRow class="mb-3">
          <VCol cols="12" md="7">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm" height="320" type="image" />
              <MonthlyTrendChart
                v-else
                :date="displaySampleDate"
                :filter-key="app.selectedMorphology"
                :height="320"
                :site-id="farm.id"
                :title="`Monthly Microplastic Trend for ${farm.site_name}`"
              />
            </div>
          </VCol>
          <VCol cols="12" md="5">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm || sizeComparisonLoading" height="320" type="image" />
              <BiologicalRiskChart v-else :data="biologicalRiskData" :height="320" />
            </div>
          </VCol>
        </VRow>

        <!-- Row 5: Source degradation (full width) -->
        <VRow class="mb-3">
          <VCol cols="12">
            <div class="ss-card">
              <VSkeletonLoader v-if="!farm" height="300" type="image" />
              <SourceDegradationIndex v-else height="300" :sites="farmAsArray" />
            </div>
          </VCol>
        </VRow>

      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Add computed `farmDominantMorphology` to the `<script setup>` block**

Find the existing `farmTotalMP` computed (around line 243 in original) and add the following immediately after it:

```js
const farmDominantMorphology = computed(() => {
  const d = microplasticData.value
  const labelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }
  const [key] = Object.entries(d).reduce((a, b) => (Number(b[1]) || 0) > (Number(a[1]) || 0) ? b : a, ['', 0])
  return labelsMap[key] || '—'
})
```

- [ ] **Step 3: Add styles — replace or append the `<style>` block in `[farm_name].vue`**

```vue
<style scoped>
.insight-page {
  background: var(--ss-bg);
  min-height: 100vh;
}

/* Sticky header */
.page-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--ss-surface);
  border-bottom: var(--ss-card-border);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1;
  margin: 0;
}

.header-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0;
}

/* KPI bar */
.kpi-bar {
  position: sticky;
  top: 57px;
  z-index: 19;
  background: var(--ss-surface);
  border-bottom: var(--ss-card-border);
  padding: 10px 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 959px) {
  .kpi-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-bar-skeleton { grid-column: 1 / -1; }

.kpi-bar-item { display: flex; flex-direction: column; }

.kpi-bar-divider {
  width: 1px;
  background: var(--ss-border);
  align-self: stretch;
}

.kpi-bar-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--ss-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 2px;
}

.kpi-bar-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--ss-text-primary);
  line-height: 1;
}

.kpi-bar-sub {
  font-size: 10px;
  color: var(--ss-text-secondary);
  margin-top: 2px;
}

/* Content */
.page-content { padding: 20px 24px; }

/* Cards */
.ss-card {
  background: var(--ss-surface);
  border: var(--ss-card-border);
  border-radius: var(--ss-card-radius);
  box-shadow: var(--ss-card-shadow);
  padding: 16px 20px;
  height: 100%;
}

.map-card { display: flex; flex-direction: column; }

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ss-text-primary);
  margin: 0;
}

.card-subtitle {
  font-size: 11px;
  color: var(--ss-text-secondary);
  margin: 0;
}

/* Mini map */
.mini-map-wrap {
  flex: 1;
  min-height: 200px;
  border-radius: 8px;
  overflow: hidden;
}

/* Farm meta */
.farm-meta-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.farm-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.farm-meta-label {
  color: var(--ss-text-secondary);
  min-width: 100px;
}

.farm-meta-value {
  color: var(--ss-text-primary);
  font-weight: 600;
}

/* Activity list */
.activity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--ss-border);
  font-size: 13px;
  color: var(--ss-text-primary);
}

.activity-row:last-child { border-bottom: none; }
.activity-name { flex: 1; }

/* Print */
@media print {
  .page-header { position: static; }
  .kpi-bar { position: static; }
}
</style>
```

- [ ] **Step 4: Run dev server and verify farm page**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/insight/` and click any farm in the list to reach a farm insight page. Verify:
- Sticky header shows farm name + owner/practice
- KPI bar shows Total MP, Dominant Morphology, Sample Date, Land Area
- Desktop: farm details and mini-map side by side
- Desktop: charts in two-column layout below
- Mobile (DevTools): everything stacks single-column, mini-map at 200px height
- All chart cards have the consistent card style (white, border, shadow, 12px radius)

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Run lint**

```bash
pnpm lint
```

Fix any reported issues before committing.

- [ ] **Step 7: Commit**

```bash
git add src/pages/insight/\[farm_name\].vue
git commit -m "feat: farm insight page — sticky header + KPI bar + two-column layout + mobile"
```

---

## Done

After all 5 tasks, run a final check:

```bash
pnpm test && pnpm build
```

Expected: tests pass, build succeeds with no errors. Open the production preview with `pnpm preview` and verify all three pages look correct at mobile (375px), tablet (768px), and desktop (1280px) widths.
