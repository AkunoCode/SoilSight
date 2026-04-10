---
name: soilsight-add-composable
description: Use when adding a new composable to src/composables/ in the SoilSight project
---

# Add Composable

Composables live in `src/composables/` with a co-located `.test.js` file.

## Data Flow

```
useInsightData.js   → raw sites/samples from Directus or dummyData.json
useInsightKPIs.js   → aggregated metrics (totals, averages, extremes)
useInsightCharts.js → ApexCharts-ready series/options transforms
useMapMarkers.js    → Leaflet marker configs
```

Add to the appropriate layer. New data fetching → `useInsightData`. New metrics → `useInsightKPIs`. New chart shape → `useInsightCharts`.

## Composable Pattern

```js
import { computed, ref } from 'vue'

export function useMyComposable(sites) {
  // reactive state
  const result = computed(() => {
    // transform sites.value
  })

  return { result }
}
```

## Test Pattern

```js
// useMyComposable.test.js
import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useMyComposable } from './useMyComposable.js'

describe('useMyComposable', () => {
  it('returns empty result for empty input', () => {
    const { result } = useMyComposable(ref([]))
    expect(result.value).toEqual(/* expected */)
  })

  it('computes correctly for known data', () => {
    const sites = ref([{ id: 1, fragment_count: 10, soilsamples: [] }])
    const { result } = useMyComposable(sites)
    expect(result.value).toBe(/* expected */)
  })
})
```

## Rules

- Accept reactive refs as arguments (`sites`, `colorData`) — don't call `useInsightData` inside
- Return only what callers need
- No side effects; pure computed transforms only (except `useInsightData` which owns fetching)
- Co-locate test file: `useMyComposable.test.js` next to `useMyComposable.js`
- Run `pnpm test:watch` during development

## Checklist

- [ ] File: `src/composables/useMyComposable.js`
- [ ] Test file: `src/composables/useMyComposable.test.js`
- [ ] Accepts reactive refs as args
- [ ] Returns computed refs
- [ ] Tests cover empty input + known data cases
- [ ] `pnpm test` passes
