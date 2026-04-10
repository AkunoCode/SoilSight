<script setup>
  import { computed } from 'vue'
  import { CHART_COLORS } from '@/config/chartPalette.js'
  import ApexChartBase from './ApexChartBase.vue'
  import { calculateTotalMP } from '@/utils/microplasticsHelper.js'

  const props = defineProps({
    // Array of site objects with soil_type and counts/mass
    sites: { type: Array, default: () => [] },
    height: { type: [Number, String], default: 360 },
  })

  function normalizeSoil (val) {
    if (!val) return 'Other'

    // Standardize: lowercase, remove hyphens/slashes/underscores, collapse spaces
    const s = String(val).toLowerCase().replace(/[-/_]/g, ' ').replace(/\s+/g, ' ').trim()

    // 1. Check Specific Compounds FIRST (Longer matches)
    // Checking 'clay loam' first prevents it from being caught by 'clay' or 'loam'
    if (s.includes('silty clay loam')) return 'Silty Clay Loam'
    if (s.includes('sandy clay loam')) return 'Sandy Clay Loam'
    if (s.includes('clay loam')) return 'Clay Loam'

    if (s.includes('silty clay')) return 'Silty Clay'
    if (s.includes('sandy clay')) return 'Sandy Clay'
    if (s.includes('sandy loam')) return 'Sandy Loam'
    if (s.includes('silty loam')) return 'Silty Loam'

    // 2. Check General Components LAST (Shorter matches)
    if (s.includes('clay')) return 'Clay'
    if (s.includes('loam')) return 'Loam'
    if (s.includes('sand')) return 'Sandy'
    if (s.includes('silt')) return 'Silt'

    return 'Other'
  }

  // Helper to calculate quartiles
  function quantile (arr, q) {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base])
    }
    return sorted[base]
  }

  const statsBySoil = computed(() => {
    const buckets = new Map()

    for (const site of props.sites || []) {
      const soilName = normalizeSoil(site.soil_type)

      // Compute microplastic density (MP/kg)
      const totalMP = calculateTotalMP(site)

      // Sum mass from soilsamples if available
      const samples = Array.isArray(site.soilsamples) ? site.soilsamples : []
      const totalMassKg = samples.reduce((sum, s) => sum + (Number(s.mass_kg) || 0), 0)

      if (totalMassKg <= 0) continue // cannot compute density
      const density = totalMP / totalMassKg

      if (!buckets.has(soilName)) buckets.set(soilName, [])
      buckets.get(soilName).push(density)
    }

    // Convert buckets to Boxplot format [min, q1, median, q3, max]
    return Array.from(buckets.entries()).map(([soil, arr]) => {
      const min = Math.min(...arr)
      const max = Math.max(...arr)
      const q1 = quantile(arr, 0.25)
      const med = quantile(arr, 0.5)
      const q3 = quantile(arr, 0.75)
      return { soil, y: [min, q1, med, q3, max] }
    })
  })

  const chartSeries = computed(() => [{
    name: 'MP/kg distribution',
    data: statsBySoil.value.map(s => ({ x: s.soil, y: s.y })),
  }])

  // --- 3. CHART CONFIGURATION ---
  const chartOptions = computed(() => ({
    chart: {
      type: 'boxPlot',
      height: props.height,
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    plotOptions: {
      boxPlot: {
        colors: {
          upper: CHART_COLORS[2] || '#2154AB',
          lower: CHART_COLORS[0] || '#85A4D6',
        },
      },
    },
    xaxis: {
      type: 'category',
      title: { text: 'Soil Type' },
    },
    yaxis: {
      title: { text: 'Microplastic Density (MP/kg)' },
      labels: {
        formatter: val => val.toFixed(2),
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const point = w.config.series[seriesIndex].data[dataPointIndex]
        if (!point) return ''
        const [min, q1, med, q3, max] = point.y
        return `<div style="padding:8px; font-size:12px; line-height:1.6;">`
          + `<div><strong>${point.x}</strong></div>`
          + `<div>Max: <b>${max.toFixed(2)}</b></div>`
          + `<div>Q3: ${q3.toFixed(2)}</div>`
          + `<div>Median: <b>${med.toFixed(2)}</b></div>`
          + `<div>Q1: ${q1.toFixed(2)}</div>`
          + `<div>Min: ${min.toFixed(2)}</div>`
          + `</div>`
      },
    },
    grid: { padding: { right: 12 } },
    colors: [CHART_COLORS[1] || '#4A7DD3'],
  }))
</script>

<template>
  <div class="boxplot-card">
    <div class="header">
      <h4 class="title">Soil Trap Efficiency</h4>
      <p class="subtitle">MP/kg distribution by soil type (Boxplot)</p>
    </div>

    <div class="chart-slot" :style="{ minHeight: height + 'px' }">
      <div v-if="chartSeries[0].data.length === 0" class="state">
        No density data available
      </div>
      <ApexChartBase
        v-else
        :height="height"
        :options="chartOptions"
        :series="chartSeries"
        type="boxPlot"
      />
    </div>
  </div>
</template>

<style scoped>
.boxplot-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
}

.header .title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
}

.header .subtitle {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: #64748b;
}

.chart-slot {
    position: relative;
    width: 100%;
}

.state {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    height: 100%;
    font-size: 0.9rem;
    font-style: italic;
}
</style>
