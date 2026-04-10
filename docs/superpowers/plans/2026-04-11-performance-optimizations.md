# Performance Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant network requests, reduce repeated computed re-evaluation, and improve farms list rendering by introducing two Pinia stores, a shared grouping computed, and virtual scrolling.

**Architecture:** Two new setup-style Pinia stores (`useMicroplasticsStore`, `useSampleDateStore`) replace fetch logic that lived in composables, making shared async data true singletons. `useInsightCharts` gains a `sitesByInput` grouping computed (mirrors the existing `sitesByTexture` pattern). `SampledFarms.vue` swaps `<ul>/<li>` for Vuetify `<v-virtual-scroll>`.

**Tech Stack:** Vue 3, Pinia (setup store style), Vuetify 3 (`v-virtual-scroll`), Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/stores/microplastics.js` | **Create** | Singleton store: fetch microplastics once, expose `colorData`/`sizeData` as computeds |
| `src/stores/sampleDate.js` | **Create** | Singleton store: fetch latest sample date once, expose `displayLatestSampleDate` computed |
| `src/stores/microplastics.test.js` | **Create** | Tests for `useMicroplasticsStore` |
| `src/stores/sampleDate.test.js` | **Create** | Tests for `useSampleDateStore` |
| `src/composables/useInsightData.js` | **Modify** | Remove color/size fetch logic; `loadAll` delegates MP fetch to store |
| `src/composables/useInsightData.test.js` | **Modify** | Remove now-deleted color/size test mock setup |
| `src/composables/useLatestSampleDate.js` | **Delete** | Replaced by `useSampleDateStore` |
| `src/pages/insight/index.vue` | **Modify** | Source color/size state from store; remove `fetchSizeData` watcher; use `useSampleDateStore` |
| `src/pages/insight/[farm_name].vue` | **Modify** | Replace `useLatestSampleDate` with `useSampleDateStore` |
| `src/components/graphs/MonthlyTrendChart.vue` | **Modify** | Replace `useLatestSampleDate` with `useSampleDateStore` |
| `src/components/graphs/SiteDrilldownChart.vue` | **Modify** | Replace `useLatestSampleDate` with `useSampleDateStore` |
| `src/components/PreviewCard.vue` | **Modify** | Replace `useLatestSampleDate` with `useSampleDateStore` |
| `src/components/AISummary.vue` | **Modify** | Replace `useLatestSampleDate` with `useSampleDateStore` |
| `src/composables/useInsightCharts.js` | **Modify** | Add `sitesByInput` computed; rewrite `inputTotals`/`inputDrilldown` to use it |
| `src/composables/useInsightCharts.test.js` | **Modify** | Add `sitesByInput` coverage |
| `src/components/SampledFarms.vue` | **Modify** | Replace `<ul>/<li>` with `<v-virtual-scroll>` |

---

## Task 1: Create `useMicroplasticsStore`

**Files:**
- Create: `src/stores/microplastics.test.js`
- Create: `src/stores/microplastics.js`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/microplastics.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import directus from '@/composables/useDirectus.js'
import { useMicroplasticsStore } from './microplastics.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

const MOCK_ITEMS = [
  { color: 'Black', shape: 'Fragment', count: 3, equivalent_circular_diameter_um: 200 },
  { color: 'White', shape: 'Fiber', count: 2, equivalent_circular_diameter_um: 2000 },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useMicroplasticsStore', () => {
  describe('initial state', () => {
    it('starts with empty rawItems', () => {
      const store = useMicroplasticsStore()
      expect(store.rawItems).toEqual([])
      expect(store.loading).toBe(false)
    })
  })

  describe('fetch()', () => {
    it('populates rawItems on success', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.rawItems).toHaveLength(2)
    })

    it('only fetches once — second call is a no-op', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      await store.fetch()
      expect(directus.request).toHaveBeenCalledTimes(1)
    })

    it('handles { data: [...] } response shape', async () => {
      directus.request.mockResolvedValue({ data: MOCK_ITEMS })
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.rawItems).toHaveLength(2)
    })

    it('sets error on failure and leaves rawItems empty', async () => {
      directus.request.mockRejectedValue(new Error('403 Forbidden'))
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.error).toBeTruthy()
      expect(store.rawItems).toEqual([])
    })
  })

  describe('colorData computed', () => {
    it('returns empty shape when rawItems is empty', () => {
      const store = useMicroplasticsStore()
      expect(store.colorData).toEqual({
        categories: [], totals: [], drilldown: [], overviewColors: [],
      })
    })

    it('groups items by color and totals their count', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      const blackIdx = store.colorData.categories.indexOf('Black')
      expect(blackIdx).toBeGreaterThanOrEqual(0)
      expect(store.colorData.totals[blackIdx]).toBe(3)
    })
  })

  describe('sizeData computed', () => {
    it('returns zeroed bucket totals when rawItems is empty', () => {
      const store = useMicroplasticsStore()
      expect(store.sizeData.categories.length).toBeGreaterThan(0)
      expect(store.sizeData.totals.every(n => n === 0)).toBe(true)
    })

    it('buckets items by equivalent_circular_diameter_um', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      const total = store.sizeData.totals.reduce((a, b) => a + b, 0)
      expect(total).toBe(5) // count: 3 + count: 2
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/stores/microplastics.test.js
```

Expected: FAIL — `Cannot find module './microplastics.js'`

- [ ] **Step 3: Create the store**

Create `src/stores/microplastics.js`:

```js
import { readItems } from '@directus/sdk'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import directus from '@/composables/useDirectus.js'
import { MP_SIZE_BUCKETS } from '@/config/constants.js'
import { areaToDiameter, morphologyIndex, toNumber } from '@/utils/microplasticsHelper.js'

export const useMicroplasticsStore = defineStore('microplastics', () => {
  const rawItems = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedSizeField = ref('equivalent_circular_diameter_um')

  async function fetch () {
    if (rawItems.value.length) return
    loading.value = true
    try {
      const resp = await directus.request(readItems('microplastics', { limit: -1 }))
      rawItems.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (err) {
      error.value = err
      console.error('useMicroplasticsStore: fetch failed', err)
    } finally {
      loading.value = false
    }
  }

  const colorData = computed(() => {
    const items = rawItems.value
    if (items.length === 0) {
      return { categories: [], totals: [], drilldown: [], overviewColors: [] }
    }
    const counts = new Map()
    const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'
    for (const it of items) {
      const rawColor = it.color || 'unknown'
      const norm = normKey(rawColor)
      if (!counts.has(norm)) {
        counts.set(norm, { count: 0, display: rawColor, drilldown: [0, 0, 0, 0, 0] })
      }
      const obj = counts.get(norm)
      const amount = Number(it.count || 1)
      obj.count += amount
      const midx = morphologyIndex(it.shape)
      if (midx >= 0) obj.drilldown[midx] += amount
    }
    const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 12)
    return {
      categories: arr.map(x => x.display),
      totals: arr.map(x => x.count),
      drilldown: arr.map(x => x.drilldown),
      overviewColors: arr.map((_, i) => `hsl(${220 - i * 20}, 60%, 45%)`),
    }
  })

  const sizeData = computed(() => {
    const items = rawItems.value
    const fieldKey = selectedSizeField.value
    const buckets = MP_SIZE_BUCKETS
    const totals = Array.from({ length: buckets.length }).fill(0)
    const drilldown = Array.from({ length: buckets.length }).fill(0).map(() => [0, 0, 0, 0, 0])
    for (const it of items) {
      const amount = Number(it.count || 1)
      let val = toNumber(it[fieldKey])
      if (Number.isNaN(val) && it.size > 0) {
        const s = it.size.toLowerCase()
        const num = Number.parseFloat(s)
        if (!Number.isNaN(num)) val = s.includes('mm') ? num * 1000 : num
      }
      if (fieldKey === 'area_um2' && Number.isFinite(val)) val = areaToDiameter(val)
      let bIdx = -1
      if (Number.isFinite(val)) {
        for (const [i, bucket] of buckets.entries()) {
          if (val >= bucket.min && val < bucket.max) { bIdx = i; break }
        }
      }
      const midx = morphologyIndex(it.shape)
      if (bIdx >= 0) {
        totals[bIdx] += amount
        if (midx >= 0) drilldown[bIdx][midx] += amount
      }
    }
    return {
      categories: buckets.map(b => b.label),
      totals,
      drilldown,
      overviewColors: buckets.map(() => '#366ECE'),
    }
  })

  return { rawItems, loading, error, selectedSizeField, fetch, colorData, sizeData }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/stores/microplastics.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/microplastics.js src/stores/microplastics.test.js
git commit -m "feat: add useMicroplasticsStore — singleton MP fetch with colorData/sizeData computeds"
```

---

## Task 2: Create `useSampleDateStore`

**Files:**
- Create: `src/stores/sampleDate.test.js`
- Create: `src/stores/sampleDate.js`

- [ ] **Step 1: Write the failing tests**

Create `src/stores/sampleDate.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import directus from '@/composables/useDirectus.js'
import { useSampleDateStore } from './sampleDate.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useSampleDateStore', () => {
  describe('initial state', () => {
    it('starts with null latestSampleDate', () => {
      const store = useSampleDateStore()
      expect(store.latestSampleDate).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('fetch()', () => {
    it('sets latestSampleDate from API response', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBe('2025-03-15')
    })

    it('only fetches once — second call is a no-op', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      await store.fetch()
      expect(directus.request).toHaveBeenCalledTimes(1)
    })

    it('leaves latestSampleDate null on empty response', async () => {
      directus.request.mockResolvedValue([])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBeNull()
    })

    it('handles { data: [...] } response shape', async () => {
      directus.request.mockResolvedValue({ data: [{ date_collected: '2025-06-01' }] })
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBe('2025-06-01')
    })
  })

  describe('displayLatestSampleDate computed', () => {
    it('formats a valid ISO date string as human-readable', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.displayLatestSampleDate).toMatch(/March/)
      expect(store.displayLatestSampleDate).toMatch(/2025/)
    })

    it('falls back to a non-empty string when latestSampleDate is null', () => {
      const store = useSampleDateStore()
      expect(typeof store.displayLatestSampleDate).toBe('string')
      expect(store.displayLatestSampleDate.length).toBeGreaterThan(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/stores/sampleDate.test.js
```

Expected: FAIL — `Cannot find module './sampleDate.js'`

- [ ] **Step 3: Create the store**

Create `src/stores/sampleDate.js`:

```js
import { readItems } from '@directus/sdk'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import directus from '@/composables/useDirectus.js'

export const useSampleDateStore = defineStore('sampleDate', () => {
  const latestSampleDate = ref(null)
  const loading = ref(false)
  const fetched = ref(false)

  async function fetch () {
    if (fetched.value) return
    loading.value = true
    try {
      const resp = await directus.request(readItems('soilsamples', { sort: ['-date_collected'], limit: 1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      latestSampleDate.value = items[0]?.date_collected ?? null
      fetched.value = true
    } catch (error) {
      console.warn('useSampleDateStore: failed to fetch latest soilsample date', error)
      latestSampleDate.value = null
    } finally {
      loading.value = false
    }
  }

  const displayLatestSampleDate = computed(() => {
    const d = latestSampleDate.value
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!d) return currentDate
    try {
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return currentDate
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return currentDate
    }
  })

  return { latestSampleDate, loading, fetched, fetch, displayLatestSampleDate }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/stores/sampleDate.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/sampleDate.js src/stores/sampleDate.test.js
git commit -m "feat: add useSampleDateStore — singleton latest-sample-date fetch"
```

---

## Task 3: Update `useInsightData` to delegate MP fetch to store

**Files:**
- Modify: `src/composables/useInsightData.js`
- Modify: `src/composables/useInsightData.test.js`

- [ ] **Step 1: Update `useInsightData.js`**

Replace the full contents of `src/composables/useInsightData.js` with:

```js
import { readItems } from '@directus/sdk'
import { ref } from 'vue'
import directus from '@/composables/useDirectus.js'
import { useMicroplasticsStore } from '@/stores/microplastics.js'

export function useInsightData () {
  const sites = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadSites () {
    loading.value = true
    error.value = null
    try {
      const resp = await directus.request(
        readItems('sites', { fields: ['*', { soilsamples: ['*'] }], limit: -1 }),
      )
      sites.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (error_) {
      error.value = error_
      console.error('Failed to load sites from Directus', error_)
    } finally {
      loading.value = false
    }
  }

  async function loadAll () {
    await loadSites()
    useMicroplasticsStore().fetch() // fire-and-forget — store guards against duplicate calls
  }

  return { sites, loading, error, loadAll }
}
```

- [ ] **Step 2: Update `useInsightData.test.js`**

Replace the full contents of `src/composables/useInsightData.test.js` with:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import directus from '@/composables/useDirectus.js'
import { useInsightData } from './useInsightData.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

// useMicroplasticsStore is called inside loadAll; mock it to prevent a second directus.request call
vi.mock('@/stores/microplastics.js', () => ({
  useMicroplasticsStore: () => ({ fetch: vi.fn() }),
}))

const MOCK_SITES = [
  { id: 1, site_name: 'Alpha Farm', fragment_count: 10, soilsamples: [] },
  { id: 2, site_name: 'Beta Farm', fragment_count: 5, soilsamples: [] },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useInsightData', () => {
  describe('initial state', () => {
    it('starts with empty sites and no error', () => {
      const { sites, loading, error } = useInsightData()
      expect(sites.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
    })
  })

  describe('loadAll', () => {
    it('populates sites after successful fetch', async () => {
      directus.request.mockResolvedValue(MOCK_SITES)
      const { sites, loadAll } = useInsightData()
      await loadAll()
      expect(sites.value).toHaveLength(2)
      expect(sites.value[0].site_name).toBe('Alpha Farm')
    })

    it('sets error when fetch fails', async () => {
      directus.request.mockRejectedValueOnce(new Error('403 Forbidden'))
      const { error, loadAll } = useInsightData()
      await loadAll()
      expect(error.value).toBeTruthy()
      expect(error.value.message).toBe('403 Forbidden')
    })

    it('handles SDK response wrapped in { data: [...] }', async () => {
      directus.request.mockResolvedValue({ data: MOCK_SITES })
      const { sites, loadAll } = useInsightData()
      await loadAll()
      expect(sites.value).toHaveLength(2)
    })
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm test src/composables/useInsightData.test.js
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/composables/useInsightData.js src/composables/useInsightData.test.js
git commit -m "refactor: delegate microplastics fetch from useInsightData to useMicroplasticsStore"
```

---

## Task 4: Update `index.vue` to consume stores

**Files:**
- Modify: `src/pages/insight/index.vue`

- [ ] **Step 1: Update the `<script setup>` block**

In `src/pages/insight/index.vue`, replace the script setup section (lines 1–73) with:

```js
<script setup>
  import { onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { useInsightCharts } from '@/composables/useInsightCharts.js'
  import { useInsightData } from '@/composables/useInsightData.js'
  import { useInsightKPIs } from '@/composables/useInsightKPIs.js'
  import { MP_COLOR_MAP } from '@/config/chartPalette.js'
  import { useMicroplasticsStore } from '@/stores/microplastics.js'
  import { useSampleDateStore } from '@/stores/sampleDate.js'
  import { useAppStore } from '@/stores/app'

  const router = useRouter()
  const app = useAppStore()

  const sampleDateStore = useSampleDateStore()
  const { displayLatestSampleDate } = storeToRefs(sampleDateStore)

  const mpStore = useMicroplasticsStore()
  const { colorData, sizeData, selectedSizeField } = storeToRefs(mpStore)
  const colorLoading = computed(() => mpStore.loading)

  const { sites, loading, error, loadAll } = useInsightData()

  const {
    microplasticTotals,
    avgContaminationDensity,
    dominantPollutant,
    highestRiskSite,
  } = useInsightKPIs(sites, colorData)

  const {
    siteCategories, siteTotals, siteDrilldown,
    inputTotals, inputDrilldown,
    textures, textureTotals, textureDrilldown,
    contaminationByPracticeSeries, contaminationByPracticeOptions,
    biologicalRiskData,
    farmSizeSeries, farmSizeOptions,
    topCrops,
  } = useInsightCharts(sites, sizeData)

  const mpColors = { ...MP_COLOR_MAP }
  const donutColors = { ...MP_COLOR_MAP }
  const donutLabelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }

  const microplasticData = microplasticTotals

  // Aliases — template uses these original variable names
  const colorComparisonLoading = colorLoading
  const colorComparisonAll = colorData
  const sizeComparisonAll = sizeData

  function handleLegendClick (key) {
    app.toggleSelectedMorphology(key)
  }
  function printReport () {
    window.print()
  }

  onMounted(async () => {
    try {
      app.startLoading()
      await loadAll()
      sampleDateStore.fetch() // fire-and-forget — non-critical, store guards duplicates
    } finally {
      try {
        app.finishLoading()
      } catch { /* ignore */ }
    }
  })
</script>
```

Note: `storeToRefs` and `computed` are auto-imported via `unplugin-auto-import` — no explicit import needed in `.vue` files.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS (the template is unchanged so no visual regression)

- [ ] **Step 3: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "refactor: wire index.vue to useMicroplasticsStore and useSampleDateStore"
```

---

## Task 5: Migrate remaining `useLatestSampleDate` consumers; delete composable

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`
- Modify: `src/components/graphs/MonthlyTrendChart.vue`
- Modify: `src/components/graphs/SiteDrilldownChart.vue`
- Modify: `src/components/PreviewCard.vue`
- Modify: `src/components/AISummary.vue`
- Delete: `src/composables/useLatestSampleDate.js`

Each file follows the same three-line change:

**Remove:**
```js
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
// ...
const { displayLatestSampleDate } = useLatestSampleDate()
```

**Add:**
```js
import { useSampleDateStore } from '@/stores/sampleDate.js'
// ...
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

(`storeToRefs` is auto-imported in `.vue` files.)

- [ ] **Step 1: Update `[farm_name].vue`**

In `src/pages/insight/[farm_name].vue`:
1. Replace `import useLatestSampleDate from '@/composables/useLatestSampleDate.js'` with `import { useSampleDateStore } from '@/stores/sampleDate.js'`
2. Replace `const { displayLatestSampleDate } = useLatestSampleDate()` with:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

- [ ] **Step 2: Update `MonthlyTrendChart.vue`**

In `src/components/graphs/MonthlyTrendChart.vue`:
1. Replace `import useLatestSampleDate from '@/composables/useLatestSampleDate.js'` with `import { useSampleDateStore } from '@/stores/sampleDate.js'`
2. Replace `const { displayLatestSampleDate } = useLatestSampleDate()` with:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

- [ ] **Step 3: Update `SiteDrilldownChart.vue`**

In `src/components/graphs/SiteDrilldownChart.vue`:
1. Replace `import useLatestSampleDate from '@/composables/useLatestSampleDate.js'` with `import { useSampleDateStore } from '@/stores/sampleDate.js'`
2. Replace `const { displayLatestSampleDate } = useLatestSampleDate()` with:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

- [ ] **Step 4: Update `PreviewCard.vue`**

In `src/components/PreviewCard.vue`:
1. Replace `import useLatestSampleDate from '@/composables/useLatestSampleDate.js'` with `import { useSampleDateStore } from '@/stores/sampleDate.js'`
2. Replace `const { displayLatestSampleDate } = useLatestSampleDate()` with:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

- [ ] **Step 5: Update `AISummary.vue`**

In `src/components/AISummary.vue`:
1. Replace `import useLatestSampleDate from '@/composables/useLatestSampleDate.js'` with `import { useSampleDateStore } from '@/stores/sampleDate.js'`
2. Replace `const { displayLatestSampleDate } = useLatestSampleDate()` with:
```js
const sampleDateStore = useSampleDateStore()
sampleDateStore.fetch()
const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
```

- [ ] **Step 6: Delete the composable**

```bash
rm src/composables/useLatestSampleDate.js
```

- [ ] **Step 7: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/pages/insight/\[farm_name\].vue \
        src/components/graphs/MonthlyTrendChart.vue \
        src/components/graphs/SiteDrilldownChart.vue \
        src/components/PreviewCard.vue \
        src/components/AISummary.vue
git rm src/composables/useLatestSampleDate.js
git commit -m "refactor: replace useLatestSampleDate composable with useSampleDateStore across all consumers"
```

---

## Task 6: Add `sitesByInput` computed to `useInsightCharts`

**Files:**
- Modify: `src/composables/useInsightCharts.js`
- Modify: `src/composables/useInsightCharts.test.js`

- [ ] **Step 1: Add a test for `inputTotals` correctness with multiple sites**

In `src/composables/useInsightCharts.test.js`, add inside `describe('inputTotals', ...)` after the existing test:

```js
it('accumulates MP across multiple sites sharing the same input type', () => {
  const siteA = makeSite({ plastic_activity: ['Plastic Mulching'], fragment_count: 10 })
  const siteB = makeSite({ plastic_activity: ['Plastic Mulching'], fragment_count: 5 })
  const { inputTotals } = useInsightCharts(ref([siteA, siteB]), ref(null))
  // index 1 = Plastic Mulching; both sites contribute
  expect(inputTotals.value[1]).toBe(36) // (10+5+2+3+1) + (5+5+2+3+1)
})
```

- [ ] **Step 2: Run tests to confirm the new test passes with current code** (this verifies the existing logic is correct before refactoring)

```bash
pnpm test src/composables/useInsightCharts.test.js
```

Expected: All tests PASS (including the new one)

- [ ] **Step 3: Add `sitesByInput` and rewrite `inputTotals`/`inputDrilldown`**

In `src/composables/useInsightCharts.js`, add `sitesByInput` after `sitesByPractice` (around line 95), then replace `inputTotals` and `inputDrilldown`:

**Add after `sitesByPractice` computed (after line 95):**
```js
  // Groups sites by input type in a single O(N) pass.
  // inputTotals and inputDrilldown read from this map instead of re-filtering.
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

**Replace `inputTotals` (lines 29–33) with:**
```js
  const inputTotals = computed(() =>
    INPUT_TYPES.map(type =>
      sitesByInput.value.get(type).reduce((acc, s) => acc + calculateTotalMP(s), 0),
    ),
  )
```

**Replace `inputDrilldown` (lines 35–49) with:**
```js
  const inputDrilldown = computed(() =>
    INPUT_TYPES.map(type =>
      sitesByInput.value.get(type).reduce((acc, s) => {
        acc[0] += Number(s.fragment_count) || 0
        acc[1] += Number(s.fiber_count) || 0
        acc[2] += Number(s.foam_count) || 0
        acc[3] += Number(s.film_count) || 0
        acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
        return acc
      }, [0, 0, 0, 0, 0]),
    ),
  )
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
pnpm test src/composables/useInsightCharts.test.js
```

Expected: All tests PASS (behavior is identical — the refactor only changes how the grouping is computed)

- [ ] **Step 5: Commit**

```bash
git add src/composables/useInsightCharts.js src/composables/useInsightCharts.test.js
git commit -m "perf: add sitesByInput computed to eliminate O(N×M) filtering in inputTotals/inputDrilldown"
```

---

## Task 7: Implement virtual scroll in `SampledFarms.vue`

**Files:**
- Modify: `src/components/SampledFarms.vue`

- [ ] **Step 1: Replace `<ul>/<li>` with `<v-virtual-scroll>`**

In `src/components/SampledFarms.vue`, replace the `<ul>` block in the template (lines 224–246):

```html
    <ul :class="['sampled-farms', { 'no-max-height': !showMap }]">
      <li
        v-for="site in visibleSites"
        :key="site.id"
        class="farm-row"
        @click="focusSite(site)"
        @dblclick.prevent="navigateToSite(site)"
      >

        <div class="farm-left">
          <div class="farm-name">{{ site.site_name }}</div>
          <div class="farm-addr">{{ site.address }}</div>
        </div>

        <div class="farm-right">
          <div class="farm-density">{{ site.uiDensityLabel }} MP/kg</div>
          <span class="practice-badge" :style="{ background: site.uiColor }">
            {{ toTitleCase(site._practiceName) }}
          </span>
        </div>
      </li>
    </ul>
```

With:

```html
    <v-virtual-scroll
      :items="visibleSites"
      :item-height="80"
      :height="showMap ? 250 : 480"
    >
      <template #default="{ item: site }">
        <div
          :key="site.id"
          class="farm-row"
          @click="focusSite(site)"
          @dblclick.prevent="navigateToSite(site)"
        >
          <div class="farm-left">
            <div class="farm-name">{{ site.site_name }}</div>
            <div class="farm-addr">{{ site.address }}</div>
          </div>

          <div class="farm-right">
            <div class="farm-density">{{ site.uiDensityLabel }} MP/kg</div>
            <span class="practice-badge" :style="{ background: site.uiColor }">
              {{ toTitleCase(site._practiceName) }}
            </span>
          </div>
        </div>
      </template>
    </v-virtual-scroll>
```

- [ ] **Step 2: Remove the now-replaced CSS rules**

In the `<style scoped>` block, remove the `.sampled-farms` and `.sampled-farms.no-max-height` rules:

```css
.sampled-farms {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 250px;
  overflow: auto;
}

.sampled-farms.no-max-height {
  max-height: none;
  overflow: visible;
}
```

Add `margin-bottom: 8px` to `.farm-row` so items have visual separation (replaces the `gap` that was on the `<ul>`):

```css
.farm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f6f6f7;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02) inset;
  cursor: pointer;
  margin-bottom: 8px;
}
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Step 4: Verify visually in the dev server**

```bash
pnpm dev
```

Open `http://localhost:3000` → navigate to the Insight page → confirm:
- The farms list scrolls correctly
- Clicking a farm row focuses the map marker
- Double-clicking navigates to the farm detail page
- List height is ~250px with the map visible, ~480px without

- [ ] **Step 5: Commit**

```bash
git add src/components/SampledFarms.vue
git commit -m "perf: replace farms list ul/li with v-virtual-scroll for DOM-efficient rendering"
```

---

## Final Check

- [ ] **Run the full test suite one last time**

```bash
pnpm test
```

Expected: All tests PASS

- [ ] **Verify `useLatestSampleDate.js` is gone**

```bash
ls src/composables/useLatestSampleDate.js
```

Expected: `No such file or directory`
