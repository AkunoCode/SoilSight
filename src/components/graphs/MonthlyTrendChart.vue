<script setup>
import { readItems } from '@directus/sdk'
import { computed, ref, toRef, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { ensurePlotOptionsBar, safeColorArray, updateApexChart } from '@/composables/useApexChart'
import directus from '@/composables/useDirectus'
import ApexChartBase from './ApexChartBase.vue'
import { buildMonthlyChartData } from './monthlyTrend.js'

const props = defineProps({
  microplasticData: { type: Object, required: false, default: () => ({}) },
  siteId: { type: [String, Number], required: false },
  date: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // Default to 100% so it fills container if not specified
  height: { type: [Number, String], default: '100%' },
  colors: { type: Object, default: () => ({}) },
  filterKey: { type: [String, null], default: null },
})

const height = toRef(props, 'height')
const app = useAppStore()
const { displayLatestSampleDate } = useLatestSampleDate()

const defaultDate = displayLatestSampleDate
const chartWrapper = ref(null)
const soilsampleMonthly = ref(null)
const soilsampleLoading = ref(false)

// Base Configuration
const { series: baseSeries, options: baseOptions } = buildMonthlyChartData({})
const monthlySeries = ref(baseSeries)
const monthlyOptions = ref({
  ...baseOptions,
  chart: { ...(baseOptions.chart || {}), height: props.height }
})

if (props.colors && Object.keys(props.colors).length > 0) {
  monthlyOptions.value.colors = safeColorArray(props.colors)
}

// Computed Totals from Props
const totals = computed(() => ({
  fragments: props.microplasticData?.fragments || 0,
  fibers: props.microplasticData?.fibers || 0,
  foams: props.microplasticData?.foams || 0,
  films: props.microplasticData?.films || 0,
}))

const hasData = computed(() => {
  if (soilsampleLoading.value) return true
  if (!monthlySeries.value || monthlySeries.value.length === 0) return false
  return monthlySeries.value.some(s => Array.isArray(s.data) && s.data.some(val => val > 0))
})

// Watchers to update chart configuration and data
watch([totals, soilsampleMonthly, () => props.filterKey, () => app.selectedMorphology], () => {
  const soil = soilsampleMonthly.value
  let currentSeries = []
  let currentCategories = []

  if (soil && soil.months && soil.series) {
    currentSeries = soil.series
    currentCategories = soil.months
  } else {
    const fallback = buildMonthlyChartData(totals.value)
    currentSeries = fallback.series
    currentCategories = fallback.options.xaxis?.categories || []
  }

  monthlySeries.value = currentSeries
  monthlyOptions.value = {
    ...monthlyOptions.value,
    xaxis: { ...monthlyOptions.value.xaxis, categories: currentCategories },
    chart: { ...monthlyOptions.value.chart, height: props.height }
  }

  if (props.colors && Object.keys(props.colors).length > 0) {
    monthlyOptions.value.colors = Object.values(props.colors)
  }

  monthlyOptions.value = ensurePlotOptionsBar(monthlyOptions.value)

  try {
    const inner = chartWrapper.value?.chartRef
    const filterKey = (props.filterKey || '').toString().toLowerCase()

    if (filterKey) {
      const found = (monthlySeries.value || []).find(s => (s.name || '').toLowerCase().includes(filterKey))
      updateApexChart(inner, monthlyOptions.value, found ? [found] : monthlySeries.value, true)
    } else {
      updateApexChart(inner, monthlyOptions.value, monthlySeries.value, true)
    }
  } catch (error) {
    console.warn('Chart update failed', error)
  }
}, { immediate: true })

// Data Fetching
async function fetchSoilsamplesMonthly(siteId) {
  soilsampleMonthly.value = null
  soilsampleLoading.value = true

  try {
    const now = new Date()
    const cutoffMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const cutoffIso = cutoffMonth.toISOString()

    const baseFilter = { date_collected: { _gte: cutoffIso } }
    const query = {
      filter: siteId ? { _and: [{ site: { _eq: siteId } }, baseFilter] } : baseFilter,
      limit: -1
    }

    const resp = await directus.request(readItems('soilsamples', query))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])

    if (!items || items.length === 0) return

    const monthMap = new Map()
    const getCount = (item, keys) => {
      for (const k of keys) if (item[k] != null) return Number(item[k])
      return 0
    }

    for (const s of items) {
      const d = s.date_collected ? new Date(s.date_collected) : null
      if (!d || isNaN(d.getTime()) || d < cutoffMonth) continue

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      if (!monthMap.has(key)) {
        monthMap.set(key, { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 })
      }

      const agg = monthMap.get(key)
      agg.fragments += getCount(s, ['fragment_count', 'fragments'])
      agg.fibers += getCount(s, ['fiber_count', 'fibers'])
      agg.foams += getCount(s, ['foam_count', 'foams'])
      agg.films += getCount(s, ['film_count', 'films'])
      agg.sheets += getCount(s, ['sheets_count', 'sheet_count', 'sheets'])
      // beads/pellets intentionally omitted from monthly trend aggregation
    }

    const keys = Array.from(monthMap.keys()).sort()
    if (keys.length === 0) return

    const months = keys.map(k => {
      const [y, m] = k.split('-')
      return new Date(y, m - 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
    })

    const series = [
      { name: 'Fragments', data: keys.map(k => monthMap.get(k).fragments) },
      { name: 'Fibers', data: keys.map(k => monthMap.get(k).fibers) },
      { name: 'Foam', data: keys.map(k => monthMap.get(k).foams) },
      { name: 'Films', data: keys.map(k => monthMap.get(k).films) },
      { name: 'Sheets', data: keys.map(k => monthMap.get(k).sheets) },
    ]

    soilsampleMonthly.value = { months, series }
  } catch (error) {
    console.error('Error fetching monthly samples', error)
    soilsampleMonthly.value = null
  } finally {
    soilsampleLoading.value = false
  }
}

watch(() => props.siteId, (newId) => {
  fetchSoilsamplesMonthly(newId)
}, { immediate: true })
</script>

<template>
  <div class="card">
    <div class="header-row">
      <h3>Total Monthly Microplastic Waste per Morphological Category</h3>
      <p class="subtitle">{{ subtitle || (props.date || defaultDate) }}</p>
    </div>

    <div class="content-area">
      <VProgressCircular v-if="soilsampleLoading" color="primary" indeterminate size="28" />

      <div v-else-if="!hasData" class="no-data-message">
        No data available
      </div>

      <ApexChartBase v-else ref="chartWrapper" :height="height" :options="monthlyOptions" :series="monthlySeries"
        type="line" class="chart-component" />
    </div>
  </div>
</template>

<style scoped>
/* Ensures the card fills its parent if the parent has a set height */
.card {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  /* Prevents header from squishing */
  margin-bottom: 10px;
}

.subtitle {
  color: rgb(155, 155, 155);
}

/* flex: 1 forces this container to take up all remaining space in the card.
   min-height: 0 prevents overflow issues in nested flex containers.
*/
.content-area {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
}

/* Ensure the chart fills the content area */
.chart-component {
  width: 100%;
  height: 100%;
}

.no-data-message {
  color: rgb(155, 155, 155);
  font-style: italic;
}
</style>