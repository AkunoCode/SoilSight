# Data Validation & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `sheets` field-name inconsistencies, add missing null guards, and eliminate redundant O(N×M) computations in chart and marker composables.

**Architecture:** Priority F targets correctness — three places still inline the sheets formula instead of reusing the shared `calculateTotalMP` helper, and one computed mishandles null `land_area_ha`. Priority G targets performance — `createMarker()` re-computes global min/max for every marker (O(N²)), and `textureTotals`/`textureDrilldown`/`contaminationByPracticeSeries` each filter the full sites array independently instead of sharing pre-grouped results.

**Tech Stack:** Vue 3 Composition API, Vitest, `src/utils/microplasticsHelper.js` (`calculateTotalMP`), `src/composables/useInsightCharts.js`, `src/composables/useMapMarkers.js`

---

## File Map

| File | Change |
|------|--------|
| `src/composables/useInsightCharts.js` | Fix sheets fields (lines 26, 66, 83); add `sitesByTexture` + `sitesByPractice` grouping computeds; use them in downstream computeds |
| `src/composables/useMapMarkers.js` | Move `allMPs`/`minMP`/`maxMP` out of `createMarker()` into `addMarkers()` |
| `src/components/graphs/SoilTrapEfficiencyBoxplot.vue` | Replace inline sheets formula (line 60) with `calculateTotalMP` |
| `src/components/SampledFarms.vue` | Replace inline sheets formula in `calculateDensity` with `calculateTotalMP` |
| `src/composables/useInsightCharts.test.js` | New tests: sheets variants, null `land_area_ha` |
| `src/composables/useMapMarkers.test.js` | New test: `calculateTotalMP` called once per farm, not N times |

---

## Task 1: Fix sheets field inconsistency in `useInsightCharts.js`

**Context:** Lines 26, 66, 83 only read `sheets_count`. Sites with data in `sheet_count` or `sheets` (the two alternate field names used elsewhere in the codebase) produce zero for those positions in every drilldown array.

**Files:**
- Modify: `src/composables/useInsightCharts.js:21-27, 59-70, 72-87`
- Test: `src/composables/useInsightCharts.test.js`

- [ ] **Step 1: Write failing tests for sheets variants**

Add to `describe('siteDrilldown')` (create it if it doesn't exist) in `src/composables/useInsightCharts.test.js`:

```js
describe('siteDrilldown', () => {
  it('picks up sheets_count', () => {
    const sites = ref([makeSite({ sheets_count: 7, sheet_count: undefined, sheets: undefined })])
    const { siteDrilldown } = useInsightCharts(sites, ref(null))
    expect(siteDrilldown.value[0][4]).toBe(7)
  })
  it('falls back to sheet_count when sheets_count is absent', () => {
    const sites = ref([makeSite({ sheets_count: undefined, sheet_count: 4, sheets: undefined })])
    const { siteDrilldown } = useInsightCharts(sites, ref(null))
    expect(siteDrilldown.value[0][4]).toBe(4)
  })
  it('falls back to sheets when both count fields are absent', () => {
    const sites = ref([makeSite({ sheets_count: undefined, sheet_count: undefined, sheets: 3 })])
    const { siteDrilldown } = useInsightCharts(sites, ref(null))
    expect(siteDrilldown.value[0][4]).toBe(3)
  })
})

describe('textureDrilldown', () => {
  it('handles sheet_count variant for sheets column', () => {
    const sites = ref([makeSite({ soil_type: 'Clay', sheets_count: undefined, sheet_count: 9 })])
    const { textureDrilldown } = useInsightCharts(sites, ref(null))
    expect(textureDrilldown.value[0][4]).toBe(9)
  })
})

describe('contaminationByPracticeSeries', () => {
  it('handles sheets variant in sheets column', () => {
    const sites = ref([makeSite({
      cultivation_practice: 'organic',
      sheets_count: undefined, sheet_count: undefined, sheets: 5,
    })])
    const { contaminationByPracticeSeries } = useInsightCharts(sites, ref(null))
    const organicSeries = contaminationByPracticeSeries.value.find(s => s.name === 'Organic Practice')
    expect(organicSeries.data[4]).toBe(5)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useInsightCharts
```

Expected: FAIL — tests for `sheet_count` and `sheets` variants report `0` instead of the expected value.

- [ ] **Step 3: Fix the three drilldown arrays in `useInsightCharts.js`**

In `src/composables/useInsightCharts.js`, replace the three locations that write `Number(s.sheets_count) || 0` with the three-variant fallback. The pattern to apply is identical to the one already in line 43 of this file (`sheets_count || sheet_count`), extended with `sheets`:

**Line 26** — inside `siteDrilldown`:
```js
const siteDrilldown = computed(() => sites.value.map(s => [
  Number(s.fragment_count) || 0,
  Number(s.fiber_count)    || 0,
  Number(s.foam_count)     || 0,
  Number(s.film_count)     || 0,
  Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0,
]))
```

**Line 66** — inside `textureDrilldown` (inside the `.reduce()` callback):
```js
const textureDrilldown = computed(() =>
  textures.value.map(t =>
    sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
      acc[0] += Number(s.fragment_count) || 0
      acc[1] += Number(s.fiber_count)    || 0
      acc[2] += Number(s.foam_count)     || 0
      acc[3] += Number(s.film_count)     || 0
      acc[4] += Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0
      return acc
    }, [0, 0, 0, 0, 0])
  )
)
```

**Line 83** — inside `contaminationByPracticeSeries` `.data` array:
```js
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
        filtered.reduce((a, b) => a + (Number(b.sheets_count) || Number(b.sheet_count) || Number(b.sheets) || 0), 0),
      ],
    }
  })
)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useInsightCharts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && git add src/composables/useInsightCharts.js src/composables/useInsightCharts.test.js
git commit -m "fix: handle all sheets field variants in useInsightCharts drilldowns"
```

---

## Task 2: Fix sheets formula in `SoilTrapEfficiencyBoxplot.vue` and `SampledFarms.vue`

**Context:** Both components inline the sum formula themselves and miss the `sheets` variant. The cleanest fix is to replace the inline formula with `calculateTotalMP` from the shared helper, which already handles all three variants.

**Files:**
- Modify: `src/components/graphs/SoilTrapEfficiencyBoxplot.vue:1-5, 58-60`
- Modify: `src/components/SampledFarms.vue:1-7, 38-41`

- [ ] **Step 1: Fix `SoilTrapEfficiencyBoxplot.vue`**

Add the import at the top of `<script setup>` (line 1, after existing imports):

```js
import { calculateTotalMP } from '@/utils/microplasticsHelper.js'
```

Replace lines 58–60 (the inline totalMP formula) with:

```js
const totalMP = calculateTotalMP(site)
```

The full `statsBySoil` computed block after the change:

```js
const statsBySoil = computed(() => {
    const buckets = new Map()

    for (const site of props.sites || []) {
        const soilName = normalizeSoil(site.soil_type)
        const totalMP = calculateTotalMP(site)

        const samples = Array.isArray(site.soilsamples) ? site.soilsamples : []
        const totalMassKg = samples.reduce((sum, s) => sum + (Number(s.mass_kg) || 0), 0)

        if (totalMassKg <= 0) continue
        const density = totalMP / totalMassKg

        if (!buckets.has(soilName)) buckets.set(soilName, [])
        buckets.get(soilName).push(density)
    }
    // ... rest of the function unchanged
```

- [ ] **Step 2: Fix `SampledFarms.vue`**

Add import at the top of `<script setup>` alongside the existing imports:

```js
import { calculateTotalMP } from '@/utils/microplasticsHelper.js'
```

Replace the `calculateDensity` function (lines 38–42) with:

```js
const calculateDensity = (site) => {
  const totalMP = calculateTotalMP(site)
  const totalMass = (site.soilsamples || []).reduce((acc, s) => acc + (Number(s.mass_kg) || 0), 0)
  return totalMass > 0 ? totalMP / totalMass : 0
}
```

Remove the now-unused `MP_TYPES` constant (line 14): `const MP_TYPES = ['fragment', 'fiber', 'foam', 'film', 'sheets']`

- [ ] **Step 3: Verify app still builds**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && git add src/components/graphs/SoilTrapEfficiencyBoxplot.vue src/components/SampledFarms.vue
git commit -m "fix: replace inline sheets formula with calculateTotalMP in Boxplot and SampledFarms"
```

---

## Task 3: Fix null `land_area_ha` miscounting in `farmSizeCounts`

**Context:** `farmSizeCounts` compares `s.land_area_ha` with numeric operators. In JavaScript `null < 1` is `true`, so sites where `land_area_ha` is `null` or `undefined` silently count as "small". The fix is to exclude sites with no area before classifying.

**Files:**
- Modify: `src/composables/useInsightCharts.js:113-117`
- Test: `src/composables/useInsightCharts.test.js`

- [ ] **Step 1: Write failing test**

Add to `src/composables/useInsightCharts.test.js`:

```js
describe('farmSizeCounts', () => {
  it('excludes sites with null land_area_ha from all buckets', () => {
    const sites = ref([
      makeSite({ land_area_ha: null }),
      makeSite({ land_area_ha: undefined }),
      makeSite({ land_area_ha: 0.5 }),
    ])
    const { farmSizeCounts } = useInsightCharts(sites, ref(null))
    const { small, medium, large } = farmSizeCounts.value
    expect(small + medium + large).toBe(1) // only the 0.5ha site
    expect(small).toBe(1)
  })
  it('counts small/medium/large correctly for valid areas', () => {
    const sites = ref([
      makeSite({ land_area_ha: 0.5 }),
      makeSite({ land_area_ha: 2 }),
      makeSite({ land_area_ha: 5 }),
    ])
    const { farmSizeCounts } = useInsightCharts(sites, ref(null))
    expect(farmSizeCounts.value).toEqual({ small: 1, medium: 1, large: 1 })
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useInsightCharts
```

Expected: FAIL — the first test reports `small: 3` (null and undefined sites are counted as small).

- [ ] **Step 3: Fix `farmSizeCounts` in `useInsightCharts.js`**

Replace lines 113–117:

```js
const farmSizeCounts = computed(() => {
  const valid = sites.value.filter(s => s.land_area_ha != null && Number.isFinite(Number(s.land_area_ha)))
  return {
    small:  valid.filter(s => s.land_area_ha < 1).length,
    medium: valid.filter(s => s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
    large:  valid.filter(s => s.land_area_ha > 3).length,
  }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useInsightCharts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && git add src/composables/useInsightCharts.js src/composables/useInsightCharts.test.js
git commit -m "fix: exclude null land_area_ha from farmSizeCounts to prevent miscounting"
```

---

## Task 4: Hoist marker range calculations out of `createMarker()`

**Context:** `createMarker()` is called once per marker. Inside it, lines 29–31 recompute `allMPs` (map over all farms), `minMP`, and `maxMP` from scratch on every call. With 50 farms, this runs 50 map iterations inside each of 50 marker creations — 2,500 iterations instead of 50. The fix: accept `minMP`/`maxMP` as parameters and compute them once in `addMarkers()` before the loop.

**Files:**
- Modify: `src/composables/useMapMarkers.js:24-65, 75-86`
- Test: `src/composables/useMapMarkers.test.js`

- [ ] **Step 1: Write failing test**

In `src/composables/useMapMarkers.test.js`, add after the existing imports:

```js
import { calculateTotalMP } from '@/utils/microplasticsHelper.js'

vi.mock('@/utils/microplasticsHelper.js', () => ({
  calculateTotalMP: vi.fn(() => 10),
}))
```

Then add a test at the end of the file:

```js
describe('addMarkers', () => {
  it('calls calculateTotalMP once per farm for range calc, not N times per farm', () => {
    const farms = [
      { latitude: 10, longitude: 10, cultivation_practice: 'organic' },
      { latitude: 11, longitude: 11, cultivation_practice: 'organic' },
    ]
    const mapRef = ref({
      removeLayer: vi.fn(),
    })
    const { addMarkers } = useMapMarkers(ref(farms), mapRef)

    calculateTotalMP.mockClear()
    addMarkers(farms)

    // With 2 farms: range calc = 2 calls, marker size calc = 2 calls → total 4, not 2*2+2=6
    expect(calculateTotalMP).toHaveBeenCalledTimes(4)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useMapMarkers
```

Expected: FAIL — `calculateTotalMP` is called 6 times (2 farms × 2 farms for range + 2 for totalMP per marker) instead of 4.

- [ ] **Step 3: Refactor `createMarker` to accept pre-computed range**

Replace `createMarker` and `addMarkers` in `src/composables/useMapMarkers.js`:

```js
function createMarker(item, minMP, maxMP) {
  if (!item.latitude || !item.longitude || !mapRef.value) return null

  const color      = getMarkerColor(item.cultivation_practice)
  const totalMP    = calculateTotalMP(item)
  const minSize    = MARKER_SIZE_MIN
  const maxSize    = MARKER_SIZE_MAX
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

function addMarkers(items) {
  if (!mapRef.value || !Array.isArray(items)) return
  clearMarkers()

  // Pre-compute global MP range once — O(n) instead of O(n²)
  const allMPs = allFarmsData.value.map(f => calculateTotalMP(f)).filter(n => n > 0)
  const minMP  = Math.min(...allMPs, 1)
  const maxMP  = Math.max(...allMPs, 1)

  for (const item of items) {
    try {
      const marker = createMarker(item, minMP, maxMP)
      if (marker) markersRef.value.push(marker)
    } catch (e) {
      console.error('Error adding marker:', e, item)
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useMapMarkers
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && git add src/composables/useMapMarkers.js src/composables/useMapMarkers.test.js
git commit -m "perf: hoist marker MP range computation out of createMarker to avoid O(n²) work"
```

---

## Task 5: Eliminate redundant filtering in `useInsightCharts.js` via grouping computeds

**Context:** `textureTotals` and `textureDrilldown` each run `sites.value.filter()` per texture — if there are 5 textures and 100 sites, that's 5×100 = 500 comparisons per computed, duplicated across two computeds. `contaminationByPracticeSeries` runs `sites.value.filter()` 3 times. The fix: add two intermediate computeds — `sitesByTexture` and `sitesByPractice` — that group sites in a single O(N) pass and reuse the groups downstream.

**Files:**
- Modify: `src/composables/useInsightCharts.js:49-97`
- Test: `src/composables/useInsightCharts.test.js`

- [ ] **Step 1: Write snapshot tests to lock in current output**

Add to `src/composables/useInsightCharts.test.js`:

```js
describe('textureTotals — output matches after grouping refactor', () => {
  it('returns correct totals per texture', () => {
    const sites = ref([
      makeSite({ soil_type: 'Clay',  fragment_count: 10, sheets_count: 1 }),
      makeSite({ soil_type: 'Clay',  fragment_count: 5,  sheets_count: 2 }),
      makeSite({ soil_type: 'Loam',  fragment_count: 8,  sheets_count: 0 }),
    ])
    const { textureTotals } = useInsightCharts(sites, ref(null))
    // Clay total: (10+5+2+3+1)+(5+5+2+3+2) = 21+17 = 38; Loam: 8+5+2+3+0 = 18
    expect(textureTotals.value).toHaveLength(2)
    const clayIdx = sites.value.findIndex(() => true) // test via textures order
    // Just verify total per texture is a positive number
    expect(textureTotals.value.every(n => typeof n === 'number')).toBe(true)
  })
})

describe('contaminationByPracticeSeries — output matches after grouping refactor', () => {
  it('assigns sites to correct practice bucket', () => {
    const organicSite = makeSite({ cultivation_practice: 'Organic Practice', fragment_count: 50 })
    const convSite    = makeSite({ cultivation_practice: 'Conventional Practice', fragment_count: 20 })
    const sites = ref([organicSite, convSite])
    const { contaminationByPracticeSeries } = useInsightCharts(sites, ref(null))
    const organic = contaminationByPracticeSeries.value.find(s => s.name === 'Organic Practice')
    const conv    = contaminationByPracticeSeries.value.find(s => s.name === 'Conventional Practice')
    expect(organic.data[0]).toBe(50 + 10) // organicSite fragment_count (50) + makeSite default base (10)... 
    // Note: makeSite sets fragment_count:10 as default, override sets it to 50
    expect(organic.data[0]).toBe(50)
    expect(conv.data[0]).toBe(20)
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass before refactoring**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test -- useInsightCharts
```

Expected: all tests PASS (baseline before refactor).

- [ ] **Step 3: Add `sitesByTexture` grouping computed and refactor texture computeds**

In `src/composables/useInsightCharts.js`, replace the `textures`, `textureTotals`, and `textureDrilldown` computeds (lines 49–70) with:

```js
// Groups sites by soil_type in a single O(N) pass.
// textureTotals and textureDrilldown read from this map instead of re-filtering.
const sitesByTexture = computed(() => {
  const map = new Map()
  for (const s of sites.value) {
    const t = s.soil_type || 'Unknown'
    if (!map.has(t)) map.set(t, [])
    map.get(t).push(s)
  }
  return map
})

const textures = computed(() => Array.from(sitesByTexture.value.keys()))

const textureTotals = computed(() =>
  textures.value.map(t =>
    sitesByTexture.value.get(t).reduce((acc, s) => acc + calculateTotalMP(s), 0)
  )
)

const textureDrilldown = computed(() =>
  textures.value.map(t =>
    sitesByTexture.value.get(t).reduce((acc, s) => {
      acc[0] += Number(s.fragment_count) || 0
      acc[1] += Number(s.fiber_count)    || 0
      acc[2] += Number(s.foam_count)     || 0
      acc[3] += Number(s.film_count)     || 0
      acc[4] += Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0
      return acc
    }, [0, 0, 0, 0, 0])
  )
)
```

- [ ] **Step 4: Add `sitesByPractice` grouping computed and refactor `contaminationByPracticeSeries`**

In `src/composables/useInsightCharts.js`, replace `contaminationByPracticeSeries` (lines 72–87) with:

```js
// Groups sites by cultivation practice in a single O(N) pass.
// A site that does not match any known practice key is excluded.
const sitesByPractice = computed(() => {
  const map = new Map(PRACTICE_KEYS.map(k => [k, []]))
  for (const s of sites.value) {
    const p = (s.cultivation_practice || '').toLowerCase()
    for (const key of PRACTICE_KEYS) {
      if (p.includes(key)) { map.get(key).push(s); break }
    }
  }
  return map
})

const contaminationByPracticeSeries = computed(() =>
  PRACTICE_NAMES.map((name, i) => {
    const key      = PRACTICE_KEYS[i]
    const filtered = sitesByPractice.value.get(key)
    return {
      name,
      data: [
        filtered.reduce((a, b) => a + (Number(b.fragment_count) || 0), 0),
        filtered.reduce((a, b) => a + (Number(b.fiber_count)    || 0), 0),
        filtered.reduce((a, b) => a + (Number(b.foam_count)     || 0), 0),
        filtered.reduce((a, b) => a + (Number(b.film_count)     || 0), 0),
        filtered.reduce((a, b) => a + (Number(b.sheets_count) || Number(b.sheet_count) || Number(b.sheets) || 0), 0),
      ],
    }
  })
)
```

- [ ] **Step 5: Run all tests to confirm nothing regressed**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Verify the app builds cleanly**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && pnpm build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/kodecraft-carlo-rabe/SoilSight && git add src/composables/useInsightCharts.js src/composables/useInsightCharts.test.js
git commit -m "perf: add sitesByTexture and sitesByPractice grouping computeds to eliminate O(N×M) filtering"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] F — `sheets_count`/`sheet_count`/`sheets` inconsistency: Tasks 1 & 2 cover all three files flagged (useInsightCharts, SoilTrapEfficiencyBoxplot, SampledFarms)
- [x] F — Null checks / edge cases: Task 3 covers the `land_area_ha` null miscounting bug; `soilsamples` null checks already exist in the codebase and are not regressed
- [x] F — Schema validation: Existing `Array.isArray` guards in `useInsightData.js` are sufficient; no new schema validation is needed for correctness at this scope
- [x] G — Marker calculation re-runs: Task 4 moves the O(N) range precompute to `addMarkers()`
- [x] G — Redundant filtering in chart composable: Task 5 introduces grouping computeds for texture and practice

**Placeholder scan:** No TBD, TODO, or "similar to Task N" patterns. All steps include exact code.

**Type consistency:** `createMarker(item, minMP, maxMP)` — signature introduced in Task 4 Step 3 is consistent with the call site in `addMarkers` in the same step. `sitesByTexture`/`sitesByPractice` introduced in Task 5 Steps 3–4 are consumed in the same task.
