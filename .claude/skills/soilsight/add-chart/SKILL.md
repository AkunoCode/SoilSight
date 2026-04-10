---
name: soilsight-add-chart
description: Use when adding a new chart component to the SoilSight graphs directory
---

# Add Chart Component

New charts live in `src/components/graphs/` and extend `ApexChartBase.vue`.

## Pattern

```vue
<script setup>
  import { computed } from 'vue'
  import ApexChartBase from './ApexChartBase.vue'

  const props = defineProps({
    // domain data prop (required)
    data: { type: Object, required: true },
    // standard base props
    height: { type: [Number, String], default: '100%' },
    title: { type: String, default: '' },
  })

  const chartSeries = computed(() => { /* transform props.data */ })
  const chartOptions = computed(() => ({
    chart: { type: 'bar', height: props.height, fontFamily: 'inherit', toolbar: { show: false } },
    // ... chart-specific options
  }))
</script>

<template>
  <div class="chart-card">
    <h4 v-if="title">{{ title }}</h4>
    <div v-if="!hasData" class="no-data">No data available</div>
    <ApexChartBase v-else :height="height" :options="chartOptions" :series="chartSeries" type="bar" />
  </div>
</template>
```

## Rules

- **Always** extend `ApexChartBase` — never use `<apexchart>` directly
- Set `fontFamily: 'inherit'` and `toolbar: { show: false }` in every chart config
- Data transforms go in `computed()` — never raw in the template
- Source data from `useInsightCharts.js`; add new transform there if needed
- Use `MP_COLOR_MAP` from `@/config/chartPalette.js` for microplastic type colors
- Guard with `v-if="!hasData"` + `.no-data` fallback

## Checklist

- [ ] File in `src/components/graphs/YourChart.vue`
- [ ] Extends `ApexChartBase`
- [ ] `fontFamily: 'inherit'`, `toolbar: { show: false }`
- [ ] `hasData` guard with no-data fallback
- [ ] Data sourced from `useInsightCharts.js` (add transform there if new)
- [ ] Auto-imported — no manual import needed in parent components
