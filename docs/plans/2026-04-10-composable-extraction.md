# Composable Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract bloated inline logic from `insight/index.vue` (647 lines) and `index.vue` (~590 lines) into focused composables and a shared utility, eliminating 15+ duplicate microplastic count formulas.

**Architecture:** A pure utility module (`microplasticsHelper.js`) supplies shared functions with no Vue dependency. Four composables consume it — three scoped to the insight page (`useInsightData`, `useInsightKPIs`, `useInsightCharts`) and one for the map page (`useMapMarkers`). Pages become thin orchestrators that wire composables to templates.

**Tech Stack:** Vue 3 Composition API (`ref`, `computed`), Vitest for unit tests, `@directus/sdk` (`readItems`), Leaflet

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/microplasticsHelper.js` | Pure helper functions — no Vue |
| Create | `src/utils/microplasticsHelper.test.js` | Unit tests for helpers |
| Create | `src/composables/useInsightData.js` | All 3 Directus fetches for insight page |
| Create | `src/composables/useInsightData.test.js` | Tests for data composable |
| Create | `src/composables/useInsightKPIs.js` | KPI computeds from `sites` ref |
| Create | `src/composables/useInsightKPIs.test.js` | Tests for KPI composable |
| Create | `src/composables/useInsightCharts.js` | Chart series/options computeds |
| Create | `src/composables/useInsightCharts.test.js` | Tests for chart composable |
| Create | `src/composables/useMapMarkers.js` | Leaflet marker logic |
| Modify | `src/pages/insight/index.vue` | Replace inline logic with composables |
| Modify | `src/pages/index.vue` | Replace marker logic with composable |
| Modify | `vite.config.mjs` | Add Vitest config block |

---

## Task 0: Install Vitest and Configure

**Files:**
- Modify: `vite.config.mjs`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vue/test-utils happy-dom
```

Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add Vitest config to `vite.config.mjs`**

Add a `test` block inside `defineConfig({...})`, after the `resolve` block:

```js
// vite.config.mjs  — add after the resolve block, before closing })
  test: {
    environment: 'happy-dom',
    globals: true,
  },
```

Full updated `defineConfig` call should end:
```js
  resolve: {
    alias: { '@': fileURLToPath(new URL('src', import.meta.url)) },
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 3: Add test script to `package.json`**

In `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest works**

```bash
npm run test
```

Expected output: `No test files found` (or similar — no errors, just no tests yet).

- [ ] **Step 5: Commit**

```bash
git add vite.config.mjs package.json package-lock.json
git commit -m "chore: add vitest test setup"
```

---

## Task 1: Create `microplasticsHelper.js`

**Files:**
- Create: `src/utils/microplasticsHelper.js`
- Create: `src/utils/microplasticsHelper.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/microplasticsHelper.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  calculateTotalMP,
  morphologyIndex,
  sanitizeSiteName,
  siteHasActivity,
  toNumber,
  areaToDiameter,
} from './microplasticsHelper.js'

describe('calculateTotalMP', () => {
  it('sums all MP counts from an item', () => {
    const item = { fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1 }
    expect(calculateTotalMP(item)).toBe(21)
  })
  it('handles sheets_count variant', () => {
    expect(calculateTotalMP({ sheets_count: 5 })).toBe(5)
  })
  it('handles sheet_count variant', () => {
    expect(calculateTotalMP({ sheet_count: 5 })).toBe(5)
  })
  it('handles sheets variant', () => {
    expect(calculateTotalMP({ sheets: 5 })).toBe(5)
  })
  it('treats null/undefined counts as 0', () => {
    expect(calculateTotalMP({})).toBe(0)
    expect(calculateTotalMP({ fragment_count: null })).toBe(0)
  })
})

describe('morphologyIndex', () => {
  it('returns 0 for fragment', () => expect(morphologyIndex('fragment')).toBe(0))
  it('returns 1 for fiber (case-insensitive)', () => expect(morphologyIndex('Fiber')).toBe(1))
  it('returns 2 for foam', () => expect(morphologyIndex('FOAM')).toBe(2))
  it('returns 3 for film', () => expect(morphologyIndex('film')).toBe(3))
  it('returns 4 for sheet', () => expect(morphologyIndex('sheet')).toBe(4))
  it('returns -1 for unknown shape', () => expect(morphologyIndex('unknown')).toBe(-1))
  it('returns -1 for null', () => expect(morphologyIndex(null)).toBe(-1))
})

describe('sanitizeSiteName', () => {
  it('removes the word Farm', () => expect(sanitizeSiteName('Santos Farm')).toBe('Santos'))
  it('cleans hyphens', () => expect(sanitizeSiteName('Site-A')).toBe('Site A'))
  it('handles null', () => expect(sanitizeSiteName(null)).toBe(''))
  it('handles undefined', () => expect(sanitizeSiteName(undefined)).toBe(''))
})

describe('siteHasActivity', () => {
  it('returns true when activity is in array', () => {
    const site = { plastic_activity: ['Plastic Mulching', 'Fertilizer Sacks'] }
    expect(siteHasActivity(site, 'Plastic Mulching')).toBe(true)
  })
  it('returns true when activity is in string', () => {
    const site = { plastic_activity: 'Plastic Mulching' }
    expect(siteHasActivity(site, 'plastic mulching')).toBe(true)
  })
  it('returns false when activity is absent', () => {
    const site = { plastic_activity: ['Fertilizer Sacks'] }
    expect(siteHasActivity(site, 'Plastic Mulching')).toBe(false)
  })
  it('returns false for null site', () => {
    expect(siteHasActivity(null, 'anything')).toBe(false)
  })
})

describe('toNumber', () => {
  it('converts numeric strings', () => expect(toNumber('42')).toBe(42))
  it('returns NaN for null', () => expect(Number.isNaN(toNumber(null))).toBe(true))
  it('returns NaN for empty string', () => expect(Number.isNaN(toNumber(''))).toBe(true))
})

describe('areaToDiameter', () => {
  it('converts area to diameter correctly', () => {
    const area = Math.PI * 25 // r=5 → d=10
    expect(areaToDiameter(area)).toBeCloseTo(10)
  })
  it('returns NaN for zero', () => expect(Number.isNaN(areaToDiameter(0))).toBe(true))
  it('returns NaN for negative', () => expect(Number.isNaN(areaToDiameter(-1))).toBe(true))
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test
```

Expected: errors like `Cannot find module './microplasticsHelper.js'`

- [ ] **Step 3: Create `src/utils/microplasticsHelper.js`**

```js
/**
 * Pure utility functions for microplastic data.
 * No Vue reactivity — safe to import anywhere.
 */

/**
 * Returns the total microplastic count for a site or sample item.
 * Handles all known field name variants for the sheets type.
 */
export function calculateTotalMP(item) {
  return (
    (Number(item.fragment_count) || 0) +
    (Number(item.fiber_count) || 0) +
    (Number(item.foam_count) || 0) +
    (Number(item.film_count) || 0) +
    (Number(item.sheets_count) || Number(item.sheet_count) || Number(item.sheets) || 0)
  )
}

/**
 * Maps a morphology/shape string to its array index [0–4].
 * Used to index into drilldown arrays: [fragments, fibers, foam, films, sheets].
 * Returns -1 for unrecognised shapes.
 */
export function morphologyIndex(shape) {
  const m = (shape || '').toString().toLowerCase()
  if (m.includes('fragment')) return 0
  if (m.includes('fiber')) return 1
  if (m.includes('foam')) return 2
  if (m.includes('film')) return 3
  if (m.includes('sheet')) return 4
  return -1
}

/**
 * Strips "Farm" word and separator characters from a site name.
 * e.g. "Santos Farm" → "Santos", "Site-A" → "Site A"
 */
export function sanitizeSiteName(name) {
  return String(name || '')
    .replace(/\b[Ff]arm\b/g, '')
    .replace(/[-–—_/]+/g, ' ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '')
}

/**
 * Returns true if the site's plastic_activity field contains the expected string.
 * Handles both array and string values for plastic_activity.
 */
export function siteHasActivity(site, expected) {
  if (!site || !site.plastic_activity) return false
  const raw = site.plastic_activity
  const norm = (expected || '').toString().toLowerCase().trim()
  if (Array.isArray(raw)) return raw.some(x => String(x).toLowerCase().includes(norm))
  return String(raw).toLowerCase().includes(norm)
}

/**
 * Safe Number() coercion — returns NaN for null, undefined, or empty string.
 */
export function toNumber(v) {
  if (v == null || v === '') return NaN
  const n = Number(v)
  return Number.isNaN(n) ? NaN : n
}

/**
 * Converts an area in µm² to an equivalent circular diameter in µm.
 */
export function areaToDiameter(area) {
  if (!Number.isFinite(area) || area <= 0) return NaN
  return 2 * Math.sqrt(area / Math.PI)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test
```

Expected: all tests in `microplasticsHelper.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/microplasticsHelper.js src/utils/microplasticsHelper.test.js
git commit -m "feat: add microplasticsHelper utility with unit tests"
```

---

## Task 2: Create `useInsightKPIs.js`

**Files:**
- Create: `src/composables/useInsightKPIs.js`
- Create: `src/composables/useInsightKPIs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useInsightKPIs.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useInsightKPIs } from './useInsightKPIs.js'

// Factory for a minimal site object
const makeSite = (overrides = {}) => ({
  fragment_count: 10,
  fiber_count: 5,
  foam_count: 2,
  film_count: 3,
  sheets_count: 1,
  soilsamples: [{ mass_kg: 1 }],
  site_name: 'Test Farm',
  cultivation_practice: 'conventional',
  ...overrides,
})

describe('useInsightKPIs', () => {
  describe('microplasticTotals', () => {
    it('sums counts across all sites', () => {
      const sites = ref([makeSite(), makeSite()])
      const { microplasticTotals } = useInsightKPIs(sites, ref(null))
      expect(microplasticTotals.value.fragments).toBe(20)
      expect(microplasticTotals.value.fibers).toBe(10)
      expect(microplasticTotals.value.foams).toBe(4)
      expect(microplasticTotals.value.films).toBe(6)
      expect(microplasticTotals.value.sheets).toBe(2)
    })
    it('returns zero totals for empty sites', () => {
      const { microplasticTotals } = useInsightKPIs(ref([]), ref(null))
      expect(microplasticTotals.value.fragments).toBe(0)
    })
  })

  describe('avgContaminationDensity', () => {
    it('returns "0" when no sites', () => {
      const { avgContaminationDensity } = useInsightKPIs(ref([]), ref(null))
      expect(avgContaminationDensity.value).toBe('0')
    })
    it('calculates MP per kg averaged across sites', () => {
      // totalMP=21, mass_kg=1 → density=21.00
      const site = makeSite({
        fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1,
        soilsamples: [{ mass_kg: 1 }],
      })
      const { avgContaminationDensity } = useInsightKPIs(ref([site]), ref(null))
      expect(avgContaminationDensity.value).toBe('21.00')
    })
    it('returns 0.00 density when site has no mass', () => {
      const site = makeSite({ soilsamples: [] })
      const { avgContaminationDensity } = useInsightKPIs(ref([site]), ref(null))
      expect(avgContaminationDensity.value).toBe('0.00')
    })
  })

  describe('highestRiskSite', () => {
    it('returns N/A when no sites', () => {
      const { highestRiskSite } = useInsightKPIs(ref([]), ref(null))
      expect(highestRiskSite.value.name).toBe('N/A')
    })
    it('returns site with highest total MP', () => {
      const low = makeSite({ fragment_count: 1, fiber_count: 0, foam_count: 0, film_count: 0, sheets_count: 0, site_name: 'Low Farm' })
      const high = makeSite({ fragment_count: 100, fiber_count: 0, foam_count: 0, film_count: 0, sheets_count: 0, site_name: 'High Farm' })
      const { highestRiskSite } = useInsightKPIs(ref([low, high]), ref(null))
      // sanitizeSiteName removes "Farm"
      expect(highestRiskSite.value.name).toBe('High')
      expect(highestRiskSite.value.density).toBe(100)
    })
  })

  describe('dominantPollutant', () => {
    it('returns the shape with the highest count', () => {
      const site = makeSite({ fragment_count: 100, fiber_count: 1, foam_count: 1, film_count: 1, sheets_count: 1 })
      const { dominantPollutant } = useInsightKPIs(ref([site]), ref(null))
      expect(dominantPollutant.value).toBe('Fragments')
    })
    it('includes color prefix when colorData is available', () => {
      const site = makeSite({ fragment_count: 100, fiber_count: 1, foam_count: 1, film_count: 1, sheets_count: 1 })
      // colorData: one category "Black" with drilldown[0]=50 (fragments index)
      const colorData = ref({
        categories: ['Black'],
        drilldown: [[50, 0, 0, 0, 0]],
      })
      const { dominantPollutant } = useInsightKPIs(ref([site]), colorData)
      expect(dominantPollutant.value).toBe('Black fragments')
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test
```

Expected: `Cannot find module './useInsightKPIs.js'`

- [ ] **Step 3: Create `src/composables/useInsightKPIs.js`**

```js
import { computed } from 'vue'
import { calculateTotalMP, sanitizeSiteName } from '@/utils/microplasticsHelper.js'

export function useInsightKPIs(sites, colorData) {
  const microplasticTotals = computed(() => ({
    fragments: sites.value.reduce((s, r) => s + (Number(r.fragment_count) || 0), 0),
    fibers:    sites.value.reduce((s, r) => s + (Number(r.fiber_count) || 0), 0),
    foams:     sites.value.reduce((s, r) => s + (Number(r.foam_count) || 0), 0),
    films:     sites.value.reduce((s, r) => s + (Number(r.film_count) || 0), 0),
    sheets:    sites.value.reduce((s, r) => s + (Number(r.sheets_count) || Number(r.sheet_count) || Number(r.sheets) || 0), 0),
  }))

  const avgContaminationDensity = computed(() => {
    if (!sites.value.length) return '0'
    const densities = sites.value.map(s => {
      const totalMP = calculateTotalMP(s)
      const totalMassKg = (Array.isArray(s.soilsamples) ? s.soilsamples : [])
        .reduce((sum, sample) => sum + (Number(sample.mass_kg) || 0), 0)
      return totalMassKg > 0 ? totalMP / totalMassKg : 0
    })
    return (densities.reduce((a, b) => a + b, 0) / sites.value.length).toFixed(2)
  })

  const dominantPollutant = computed(() => {
    const t = microplasticTotals.value
    const morphologies = {
      fragments: t.fragments, fibers: t.fibers, foams: t.foams, films: t.films, sheets: t.sheets,
    }
    const dominantShape = Object.entries(morphologies).reduce((a, b) => b[1] > a[1] ? b : a)[0]

    if (colorData?.value?.drilldown?.length) {
      const shapeIdx = { fragments: 0, fibers: 1, foams: 2, films: 3, sheets: 4 }[dominantShape] ?? -1
      if (shapeIdx >= 0) {
        let maxCount = 0
        let mostCommonColor = ''
        for (let i = 0; i < colorData.value.drilldown.length; i++) {
          const count = colorData.value.drilldown[i][shapeIdx] || 0
          if (count > maxCount) { maxCount = count; mostCommonColor = colorData.value.categories[i] }
        }
        if (mostCommonColor) return `${mostCommonColor} ${dominantShape}`
      }
    }
    return dominantShape.charAt(0).toUpperCase() + dominantShape.slice(1)
  })

  const highestRiskSite = computed(() => {
    if (!sites.value.length) return { name: 'N/A', density: '0' }
    return sites.value
      .map(s => ({ name: sanitizeSiteName(s.site_name), density: calculateTotalMP(s) }))
      .reduce((a, b) => b.density > a.density ? b : a)
  })

  return { microplasticTotals, avgContaminationDensity, dominantPollutant, highestRiskSite }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test
```

Expected: all `useInsightKPIs.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useInsightKPIs.js src/composables/useInsightKPIs.test.js
git commit -m "feat: add useInsightKPIs composable with unit tests"
```

---

## Task 3: Create `useInsightCharts.js`

**Files:**
- Create: `src/composables/useInsightCharts.js`
- Create: `src/composables/useInsightCharts.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useInsightCharts.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useInsightCharts } from './useInsightCharts.js'

const makeSite = (overrides = {}) => ({
  fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1,
  site_name: 'Alpha Farm',
  soil_type: 'Clay',
  land_area_ha: 0.5,
  cultivation_practice: 'organic',
  plastic_activity: ['Plastic Mulching'],
  crops: ['rice', 'corn'],
  ...overrides,
})

describe('useInsightCharts', () => {
  describe('siteCategories', () => {
    it('returns sanitized site names', () => {
      const sites = ref([makeSite({ site_name: 'Alpha Farm' })])
      const { siteCategories } = useInsightCharts(sites, ref(null))
      expect(siteCategories.value).toEqual(['Alpha'])
    })
  })

  describe('siteTotals', () => {
    it('returns total MP per site using calculateTotalMP', () => {
      const sites = ref([makeSite()])
      const { siteTotals } = useInsightCharts(sites, ref(null))
      expect(siteTotals.value[0]).toBe(21) // 10+5+2+3+1
    })
  })

  describe('inputTotals', () => {
    it('sums MP for sites with matching plastic_activity', () => {
      const site = makeSite({ plastic_activity: ['Plastic Mulching'] })
      const { inputTotals } = useInsightCharts(ref([site]), ref(null))
      // index 1 = Plastic Mulching
      expect(inputTotals.value[1]).toBe(21)
      // index 0 = Fertilizer Sacks — site does not have this
      expect(inputTotals.value[0]).toBe(0)
    })
  })

  describe('biologicalRiskData', () => {
    it('returns empty array when sizeData is null', () => {
      const { biologicalRiskData } = useInsightCharts(ref([]), ref(null))
      expect(biologicalRiskData.value).toEqual([])
    })
    it('bins size data into 3 risk categories', () => {
      const sizeData = ref({
        categories: ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm'],
        totals: [10, 20, 15, 5, 8],
      })
      const { biologicalRiskData } = useInsightCharts(ref([]), sizeData)
      expect(biologicalRiskData.value).toEqual([
        { category: '< 100 µm', count: 30 },   // 10 + 20
        { category: '100-500 µm', count: 15 },
        { category: '> 1 mm', count: 8 },
      ])
    })
  })

  describe('topCrops', () => {
    it('returns top crops sorted by count', () => {
      const sites = ref([
        makeSite({ crops: ['rice', 'corn'] }),
        makeSite({ crops: ['rice'] }),
      ])
      const { topCrops } = useInsightCharts(sites, ref(null))
      expect(topCrops.value[0].crop).toBe('Rice')
      expect(topCrops.value[0].count).toBe(2)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test
```

Expected: `Cannot find module './useInsightCharts.js'`

- [ ] **Step 3: Create `src/composables/useInsightCharts.js`**

```js
import { computed } from 'vue'
import { calculateTotalMP, sanitizeSiteName, siteHasActivity } from '@/utils/microplasticsHelper.js'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import { CHART_COLORS } from '@/config/chartPalette.js'

const INPUT_TYPES = [
  'Fertilizer Sacks',
  'Plastic Mulching',
  'Seedling Trays',
  'Compost with Plastic',
  'Greenhouse Plastic Sheet',
]
const PRACTICE_NAMES = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']
const PRACTICE_KEYS  = ['conventional', 'organic', 'integrated']

export function useInsightCharts(sites, sizeData) {
  const siteCategories = computed(() => sites.value.map(s => sanitizeSiteName(s.site_name)))

  const siteTotals = computed(() => sites.value.map(s => calculateTotalMP(s)))

  const siteDrilldown = computed(() => sites.value.map(s => [
    Number(s.fragment_count) || 0,
    Number(s.fiber_count)    || 0,
    Number(s.foam_count)     || 0,
    Number(s.film_count)     || 0,
    Number(s.sheets_count)   || 0,
  ]))

  const inputTotals = computed(() =>
    INPUT_TYPES.map(type =>
      sites.value.reduce((acc, s) => siteHasActivity(s, type) ? acc + calculateTotalMP(s) : acc, 0)
    )
  )

  const inputDrilldown = computed(() =>
    INPUT_TYPES.map(type =>
      sites.value.reduce((acc, s) => {
        if (!siteHasActivity(s, type)) return acc
        acc[0] += Number(s.fragment_count) || 0
        acc[1] += Number(s.fiber_count)    || 0
        acc[2] += Number(s.foam_count)     || 0
        acc[3] += Number(s.film_count)     || 0
        acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || 0)
        return acc
      }, [0, 0, 0, 0, 0])
    )
  )

  const textures = computed(() =>
    Array.from(new Set(sites.value.map(s => s.soil_type || 'Unknown')))
  )

  const textureTotals = computed(() =>
    textures.value.map(t =>
      sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => acc + calculateTotalMP(s), 0)
    )
  )

  const textureDrilldown = computed(() =>
    textures.value.map(t =>
      sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
        acc[0] += Number(s.fragment_count) || 0
        acc[1] += Number(s.fiber_count)    || 0
        acc[2] += Number(s.foam_count)     || 0
        acc[3] += Number(s.film_count)     || 0
        acc[4] += Number(s.sheets_count)   || 0
        return acc
      }, [0, 0, 0, 0, 0])
    )
  )

  const contaminationByPracticeSeries = computed(() =>
    PRACTICE_NAMES.map((name, i) => {
      const key = PRACTICE_KEYS[i]
      const filtered = sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(key))
      return {
        name,
        data: [
          filtered.reduce((a, b) => a + (Number(b.fragment_count) || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.fiber_count)    || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.foam_count)     || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.film_count)     || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.sheets_count)   || 0), 0),
        ],
      }
    })
  )

  const contaminationByPracticeOptions = computed(() => {
    const allVals = contaminationByPracticeSeries.value.flatMap(s => s.data)
    const maxVal = allVals.length ? Math.max(...allVals) : 700
    return getDefaultBarOptions(['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets'], {
      chart: { type: 'bar' },
      legend: { position: 'bottom' },
      yaxis: { title: { text: 'Count' }, min: 0, max: Math.ceil(maxVal * 1.1) },
    })
  })

  const biologicalRiskData = computed(() => {
    const sizes = sizeData?.value
    if (!sizes?.categories?.length) return []
    const findTotal = label => {
      const idx = sizes.categories.findIndex(c => (c || '').toLowerCase() === label.toLowerCase())
      return idx >= 0 ? (sizes.totals[idx] || 0) : 0
    }
    return [
      { category: '< 100 µm',   count: findTotal('1-20 µm') + findTotal('20-100 µm') },
      { category: '100-500 µm', count: findTotal('100-500 µm') },
      { category: '> 1 mm',     count: findTotal('1-5 mm') },
    ]
  })

  const farmSizeCounts = computed(() => ({
    small:  sites.value.filter(s => s.land_area_ha < 1).length,
    medium: sites.value.filter(s => s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
    large:  sites.value.filter(s => s.land_area_ha > 3).length,
  }))

  const farmSizeSeries = computed(() => [{
    name: 'Farms',
    data: [farmSizeCounts.value.small, farmSizeCounts.value.medium, farmSizeCounts.value.large],
  }])

  const farmSizeOptions = computed(() => ({
    chart: { type: 'bar', toolbar: { show: false } },
    xaxis: { categories: ['Small (<1ha)', 'Medium (1-3ha)', 'Large (>3ha)'] },
    plotOptions: { bar: { horizontal: false, columnWidth: '70%' } },
    legend: { show: false },
    colors: [CHART_COLORS[2]],
  }))

  const topCrops = computed(() => {
    const counts = {}
    for (const s of sites.value) {
      let raw = s.crops
      if (!raw) continue
      if (typeof raw === 'string') raw = raw.split(/[;,|\n]/).map(x => x.trim())
      if (!Array.isArray(raw)) continue
      for (const item of raw) {
        const key = String(item).toLowerCase().trim()
        if (key) counts[key] = (counts[key] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => ({ crop: c.charAt(0).toUpperCase() + c.slice(1), count: n }))
  })

  return {
    siteCategories, siteTotals, siteDrilldown,
    inputTotals, inputDrilldown,
    textures, textureTotals, textureDrilldown,
    contaminationByPracticeSeries, contaminationByPracticeOptions,
    biologicalRiskData,
    farmSizeSeries, farmSizeOptions,
    topCrops,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test
```

Expected: all `useInsightCharts.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useInsightCharts.js src/composables/useInsightCharts.test.js
git commit -m "feat: add useInsightCharts composable with unit tests"
```

---

## Task 4: Create `useInsightData.js`

This composable wraps Directus calls. Tests mock the `directus` module.

**Files:**
- Create: `src/composables/useInsightData.js`
- Create: `src/composables/useInsightData.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useInsightData.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInsightData } from './useInsightData.js'

// Mock the directus client
vi.mock('@/composables/useDirectus.js', () => ({
  default: {
    request: vi.fn(),
  },
}))

import directus from '@/composables/useDirectus.js'

const MOCK_SITES = [
  { id: 1, site_name: 'Alpha Farm', fragment_count: 10, soilsamples: [] },
  { id: 2, site_name: 'Beta Farm',  fragment_count: 5,  soilsamples: [] },
]

beforeEach(() => {
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
      // subsequent calls succeed (color + size)
      directus.request.mockResolvedValue([])
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

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test
```

Expected: `Cannot find module './useInsightData.js'`

- [ ] **Step 3: Create `src/composables/useInsightData.js`**

```js
import { ref } from 'vue'
import directus from '@/composables/useDirectus.js'
import { readItems } from '@directus/sdk'
import { morphologyIndex, toNumber, areaToDiameter } from '@/utils/microplasticsHelper.js'

export function useInsightData() {
  const sites        = ref([])
  const loading      = ref(false)
  const error        = ref(null)
  const colorData    = ref(null)
  const colorLoading = ref(false)
  const sizeData     = ref(null)
  const selectedSizeField = ref('equivalent_circular_diameter_um')

  async function loadSites() {
    loading.value = true
    error.value   = null
    try {
      const resp = await directus.request(
        readItems('sites', { fields: ['*', { soilsamples: ['*'] }], limit: -1 })
      )
      sites.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (err) {
      error.value = err
      console.error('Failed to load sites from Directus', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchColorData() {
    colorLoading.value = true
    try {
      const resp  = await directus.request(readItems('microplastics', { limit: -1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      if (!items.length) {
        colorData.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
        return
      }
      const counts  = new Map()
      const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'
      for (const it of items) {
        const rawColor = it.color || 'unknown'
        const norm     = normKey(rawColor)
        if (!counts.has(norm)) counts.set(norm, { count: 0, display: rawColor, drilldown: [0, 0, 0, 0, 0] })
        const obj    = counts.get(norm)
        const amount = Number(it.count || 1)
        obj.count   += amount
        const midx   = morphologyIndex(it.shape)
        if (midx >= 0) obj.drilldown[midx] += amount
      }
      const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 12)
      colorData.value = {
        categories:    arr.map(x => x.display),
        totals:        arr.map(x => x.count),
        drilldown:     arr.map(x => x.drilldown),
        overviewColors: arr.map((_, i) => `hsl(${220 - i * 20}, 60%, 45%)`),
      }
    } catch (e) {
      console.error('Color fetch error', e)
    } finally {
      colorLoading.value = false
    }
  }

  async function fetchSizeData(fieldKey = 'equivalent_circular_diameter_um') {
    try {
      const resp  = await directus.request(readItems('microplastics', { limit: -1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      if (!items.length) {
        sizeData.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
        return
      }
      const buckets = [
        { label: '1-20 µm',      min: 1,    max: 20   },
        { label: '20-100 µm',    min: 20,   max: 100  },
        { label: '100-500 µm',   min: 100,  max: 500  },
        { label: '500 µm-1 mm',  min: 500,  max: 1000 },
        { label: '1-5 mm',       min: 1000, max: 5000 },
      ]
      const totals   = new Array(buckets.length).fill(0)
      const drilldown = new Array(buckets.length).fill(0).map(() => [0, 0, 0, 0, 0])
      for (const it of items) {
        const amount = Number(it.count || 1)
        let val = toNumber(it[fieldKey])
        if (Number.isNaN(val) && it.size) {
          const s   = it.size.toLowerCase()
          const num = parseFloat(s)
          if (!Number.isNaN(num)) val = s.includes('mm') ? num * 1000 : num
        }
        if (fieldKey === 'area_um2' && Number.isFinite(val)) val = areaToDiameter(val)
        let bIdx = -1
        if (Number.isFinite(val)) {
          for (let i = 0; i < buckets.length; i++) {
            if (val >= buckets[i].min && val < buckets[i].max) { bIdx = i; break }
          }
        }
        const midx = morphologyIndex(it.shape)
        if (bIdx >= 0) {
          totals[bIdx] += amount
          if (midx >= 0) drilldown[bIdx][midx] += amount
        }
      }
      sizeData.value = {
        categories:    buckets.map(b => b.label),
        totals,
        drilldown,
        overviewColors: buckets.map(() => '#366ECE'),
      }
    } catch (e) {
      console.error('Size fetch error', e)
      sizeData.value = null
    }
  }

  async function loadAll() {
    await loadSites()
    await Promise.allSettled([
      fetchColorData(),
      fetchSizeData(selectedSizeField.value),
    ])
  }

  return {
    sites, loading, error,
    colorData, colorLoading,
    sizeData, selectedSizeField,
    loadAll, fetchSizeData,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test
```

Expected: all `useInsightData.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useInsightData.js src/composables/useInsightData.test.js
git commit -m "feat: add useInsightData composable with unit tests"
```

---

## Task 5: Create `useMapMarkers.js`

Leaflet cannot run in jsdom/happy-dom — tests cover the pure logic only (`getMarkerColor`). Marker creation is exercised by the dev server in Task 7.

**Files:**
- Create: `src/composables/useMapMarkers.js`
- Create: `src/composables/useMapMarkers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/composables/useMapMarkers.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

// Leaflet cannot run in Node — mock it before importing the composable
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    marker:  vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), _item: null })),
  },
}))

import { useMapMarkers } from './useMapMarkers.js'

describe('useMapMarkers', () => {
  describe('getMarkerColor', () => {
    it('returns orange for integrated', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('Integrated Practice')).toBe('#FF9800')
    })
    it('returns green for organic', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('Organic')).toBe('#4CAF50')
    })
    it('returns blue for conventional', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('conventional')).toBe('#19568E')
    })
    it('returns grey for unknown practice', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('something else')).toBe('#757575')
    })
    it('returns grey for null', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor(null)).toBe('#757575')
    })
  })

  describe('clearMarkers', () => {
    it('empties markersRef', () => {
      const mapRef = ref({ removeLayer: vi.fn() })
      const { markersRef, clearMarkers } = useMapMarkers(ref([]), mapRef)
      markersRef.value = [{ id: 1 }, { id: 2 }]
      clearMarkers()
      expect(markersRef.value).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test
```

Expected: `Cannot find module './useMapMarkers.js'`

- [ ] **Step 3: Create `src/composables/useMapMarkers.js`**

```js
import { ref } from 'vue'
import L from 'leaflet'
import { calculateTotalMP } from '@/utils/microplasticsHelper.js'

export function useMapMarkers(allFarmsData, mapRef) {
  const markersRef = ref([])

  function getMarkerColor(practice) {
    const p = (practice || '').toLowerCase()
    if (p.includes('integrated'))   return '#FF9800'
    if (p.includes('organic'))      return '#4CAF50'
    if (p.includes('conventional')) return '#19568E'
    return '#757575'
  }

  function createMarker(item) {
    if (!item.latitude || !item.longitude || !mapRef.value) return null

    const color    = getMarkerColor(item.cultivation_practice)
    const totalMP  = calculateTotalMP(item)
    const allMPs   = allFarmsData.value.map(f => calculateTotalMP(f)).filter(n => n > 0)
    const minMP    = Math.min(...allMPs, 1)
    const maxMP    = Math.max(...allMPs, 1)
    const minSize  = 15
    const maxSize  = 35
    const markerSize = totalMP > 0
      ? minSize + ((totalMP - minMP) / (maxMP - minMP)) * (maxSize - minSize)
      : minSize

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color:${color};width:${markerSize}px;height:${markerSize}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize:   [markerSize, markerSize],
      iconAnchor: [markerSize / 2, markerSize / 2],
    })

    const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(mapRef.value)
    marker._item = item
    marker.bindPopup(`
      <div style="min-width:250px;">
        <strong style="color:${color};font-size:16px;">${item.site_name ?? 'Unknown Site'}</strong><br/>
        <hr style="margin:8px 0;"/>
        <strong>Owner:</strong> ${item.owner ?? 'N/A'}<br/>
        <strong>Area:</strong> ${item.land_area_ha ?? '?'} hectares<br/>
        <strong>Practice:</strong> ${item.cultivation_practice ?? 'N/A'}<br/>
        ${totalMP > 0 ? `<strong>Microplastics:</strong> ${totalMP} particles<br/>` : ''}
        ${item.address     ? `<strong>Address:</strong> ${item.address}<br/>`         : ''}
        ${item.soil_type   ? `<strong>Soil Type:</strong> ${item.soil_type}<br/>`     : ''}
        ${item.crops       ? `<strong>Crops:</strong> ${item.crops.join(', ')}<br/>` : ''}
        ${item.water_source ? `<strong>Water Source:</strong> ${item.water_source}<br/>` : ''}
      </div>
    `)
    marker.on('click', e => {
      L.DomEvent?.stopPropagation(e)
    })
    return marker
  }

  function clearMarkers() {
    if (!mapRef.value) return
    for (const m of markersRef.value) {
      try { mapRef.value.removeLayer(m) } catch { /* ignore */ }
    }
    markersRef.value = []
  }

  function addMarkers(items) {
    if (!mapRef.value || !Array.isArray(items)) return
    clearMarkers()
    for (const item of items) {
      try {
        const marker = createMarker(item)
        if (marker) markersRef.value.push(marker)
      } catch (e) {
        console.error('Error adding marker:', e, item)
      }
    }
  }

  return { markersRef, getMarkerColor, createMarker, clearMarkers, addMarkers }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test
```

Expected: all `useMapMarkers.test.js` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useMapMarkers.js src/composables/useMapMarkers.test.js
git commit -m "feat: add useMapMarkers composable with unit tests"
```

---

## Task 6: Refactor `insight/index.vue`

Replace all inline logic with the three insight composables. **Template is unchanged.**

**Files:**
- Modify: `src/pages/insight/index.vue` — `<script setup>` only

- [ ] **Step 1: Replace the entire `<script setup>` block**

In `src/pages/insight/index.vue`, replace everything between `<script setup>` and `</script>` with:

```js
import { onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useRouter } from 'vue-router'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { useInsightData } from '@/composables/useInsightData.js'
import { useInsightKPIs } from '@/composables/useInsightKPIs.js'
import { useInsightCharts } from '@/composables/useInsightCharts.js'
import { MP_COLOR_MAP } from '@/config/chartPalette.js'

const router = useRouter()
const app    = useAppStore()
const { displayLatestSampleDate, fetchLatestSampleDate } = useLatestSampleDate()

const {
  sites, loading, error,
  colorData, colorLoading,
  sizeData, selectedSizeField,
  loadAll, fetchSizeData,
} = useInsightData()

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

const mpColors       = { ...MP_COLOR_MAP }
const donutColors    = { ...MP_COLOR_MAP }
const donutLabelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }

// microplasticData shape expected by MPDonutChart
const microplasticData = microplasticTotals

// Aliases — template uses these original variable names; renaming would require template changes
const colorComparisonLoading = colorLoading
const colorComparisonAll     = colorData
const sizeComparisonAll      = sizeData

function handleLegendClick(key) { app.toggleSelectedMorphology(key) }
function printReport() { window.print() }

watch(selectedSizeField, newVal => fetchSizeData(newVal))

onMounted(async () => {
  try {
    app.startLoading()
    await loadAll()
    try { await fetchLatestSampleDate() } catch { /* non-critical */ }
  } finally {
    try { app.finishLoading() } catch { /* ignore */ }
  }
})
```

- [ ] **Step 2: Verify the app loads correctly**

```bash
npm run dev
```

Open `http://localhost:3000/insight` in your browser. Confirm:
- KPI cards render (even if showing 0 / demo data)
- No console errors about undefined variables
- Charts render without errors

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
npm run test
```

Expected: all previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "refactor: wire insight page to useInsightData/KPIs/Charts composables"
```

---

## Task 7: Refactor `index.vue` (Map Page)

Replace marker logic with `useMapMarkers`. **Template is unchanged.**

**Files:**
- Modify: `src/pages/index.vue` — `<script setup>` only

- [ ] **Step 1: Replace the entire `<script setup>` block**

In `src/pages/index.vue`, replace everything between `<script setup>` and `</script>` with:

```js
import { CHART_COLORS } from '@/config/chartPalette'
import { readItems } from '@directus/sdk'
import L from 'leaflet'
import { computed, onMounted, ref, watch } from 'vue'
import tayabasGeoRaw from '@/assets/geojson/Tayabas.geojson?raw'
const tayabasGeo = JSON.parse(tayabasGeoRaw)
import { useAppStore } from '@/stores/app'
import PreviewCard from '@/components/PreviewCard.vue'
import directus from '@/composables/useDirectus'
import { useMapMarkers } from '@/composables/useMapMarkers.js'
import 'leaflet/dist/leaflet.css'

const selectedItem  = ref(null)
const isOverview    = ref(true)
const allFarmsData  = ref([])
const previewCardRef = ref(null)
const searchText     = ref('')
const selectedCategory = ref(null)
const regionName    = ref('Quezon Province')
const cityName      = ref('Tayabas City')
const TAYABAS       = [13.9649, 121.5923]
const mapRef        = ref(null)
let debounceTimer   = null

const { markersRef, addMarkers, clearMarkers, getMarkerColor } = useMapMarkers(allFarmsData, mapRef)

async function fetchDataFromDirectus() {
  try {
    const res   = await directus.request(readItems('sites'))
    const items = Array.isArray(res) ? res : (res?.data || [])
    allFarmsData.value = items
    return items
  } catch (error) {
    console.error('Error fetching farms data from Directus:', error)
    throw error
  }
}

function setPreviewCardData(item) {
  selectedItem.value = item
  isOverview.value   = false
  if (previewCardRef.value?.raiseCard) previewCardRef.value.raiseCard()
}

function resetToOverview() {
  selectedItem.value = null
  isOverview.value   = true
}

function gotoRegion() {
  resetToOverview()
  if (mapRef.value) mapRef.value.setView(TAYABAS, 11)
}

function gotoCity() {
  resetToOverview()
  if (mapRef.value) mapRef.value.setView(TAYABAS, 13)
}

function gotoFarm() {
  if (!selectedItem.value || !mapRef.value) return
  const item = selectedItem.value
  if (item.latitude && item.longitude) {
    mapRef.value.panTo([item.latitude, item.longitude])
    mapRef.value.setZoom(16)
  }
  if (previewCardRef.value?.raiseCard) previewCardRef.value.raiseCard()
}

const categories = computed(() => {
  const set = new Set()
  for (const i of (allFarmsData.value || [])) {
    if (i.cultivation_practice) set.add(i.cultivation_practice)
  }
  return Array.from(set.values())
})

function applyFilters() {
  const q   = (searchText.value || '').toLowerCase().trim()
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
  debounceTimer = setTimeout(() => applyFilters(), 180)
})

onMounted(async () => {
  const app = useAppStore()
  await new Promise(resolve => setTimeout(resolve, 100))
  try {
    const map = L.map('map', { zoomControl: false }).setView(TAYABAS, 13)
    mapRef.value = map
    setTimeout(() => map.panBy([-160, 0]), 100)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', resetToOverview)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const legend = L.control({ position: 'bottomright' })
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend-box')
      L.DomEvent.disableClickPropagation(div)
      const entries = [
        { label: 'Integrated',   color: getMarkerColor('integrated') },
        { label: 'Organic',      color: getMarkerColor('organic') },
        { label: 'Conventional', color: getMarkerColor('conventional') },
        { label: 'Other',        color: getMarkerColor('other') },
      ]
      let html = ''
      for (const e of entries) {
        html += `<div class="legend-entry"><span class="legend-swatch" style="background:${e.color}"></span><span class="legend-label">${e.label}</span></div>`
      }
      div.innerHTML = html
      return div
    }
    legend.addTo(map)

    try {
      const geoLayer = L.geoJSON(tayabasGeo, {
        style: { color: CHART_COLORS[0], weight: 3, dashArray: '5, 5', fillColor: CHART_COLORS[0], fillOpacity: 0.1 },
        interactive: false,
      }).addTo(map)
      map.fitBounds(geoLayer.getBounds(), { paddingTopLeft: [350, 50], paddingBottomRight: [50, 50] })
      setTimeout(() => map.panBy([-100, 0]), 200)
    } catch (geoError) {
      console.error('Error adding GeoJSON:', geoError)
    }

    try {
      app.startLoading()
      const items = await fetchDataFromDirectus()
      allFarmsData.value = items
      applyFilters()
    } catch (dataError) {
      console.error('Error loading marker data from Directus:', dataError)
    } finally {
      try { app.finishLoading() } catch { /* ignore */ }
    }

    setTimeout(() => map.invalidateSize(), 100)
  } catch (error) {
    console.error('Error initializing map:', error)
  }
})
```

- [ ] **Step 2: Verify the map page loads correctly**

```bash
npm run dev
```

Open `http://localhost:3000` in your browser. Confirm:
- Map renders with Tayabas boundary
- Legend shows four practice colours
- Search and category filter controls work
- Clicking markers opens preview card (if data is available)
- No console errors

- [ ] **Step 3: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.vue
git commit -m "refactor: wire map page to useMapMarkers composable"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests pass with no failures.

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about chunk size are acceptable.

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Open `http://localhost:4173` and `http://localhost:4173/insight`. Verify both pages load and the UI matches the pre-refactor state.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify composable extraction — all tests pass, build clean"
```
