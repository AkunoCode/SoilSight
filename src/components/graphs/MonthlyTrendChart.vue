<script setup>
import { readItems } from '@directus/sdk'
import { computed, ref, toRef, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { ensurePlotOptionsBar, safeColorArray, updateApexChart } from '@/composables/useApexChart'
// Directus
import directus from '@/composables/useDirectus'
import ApexChartBase from './ApexChartBase.vue'
import { buildMonthlyChartData } from './monthlyTrend.js'

const props = defineProps({
  microplasticData: { type: Object, required: false, default: () => ({}) },
  siteId: { type: [String, Number], required: false },
  date: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  height: { type: Number, default: 400 },
  colors: { type: Object, default: () => ({}) },
  filterKey: { type: [String, null], default: null },
})

const height = toRef(props, 'height')

const { displayLatestSampleDate } = useLatestSampleDate()
const defaultDate = displayLatestSampleDate

const totals = computed(() => ({
  fragments: props.microplasticData?.fragments || 0,
  fibers: props.microplasticData?.fibers || 0,
  foams: props.microplasticData?.foams || 0,
  films: props.microplasticData?.films || 0,
  pellets: props.microplasticData?.pellets || 0,
}))

// aggregated monthly data coming from soilsamples for a given site (if provided)
const soilsampleMonthly = ref(null)
const soilsampleLoading = ref(false)

const { series: baseSeries, options: baseOptions } = buildMonthlyChartData(totals.value)
baseOptions.chart = Object.assign({}, baseOptions.chart || {}, { height: props.height })
const monthlySeries = ref(baseSeries)
const monthlyOptions = ref(baseOptions)

// wrapper ref (exposes inner chartRef via defineExpose)
const chartWrapper = ref(null)

if (props.colors && Object.keys(props.colors).length > 0) monthlyOptions.value.colors = safeColorArray(props.colors)

const app = useAppStore()

// If soilsample-based monthly aggregation is available use that, otherwise fall back to distribution build
watch([totals, soilsampleMonthly, () => props.filterKey, () => app.selectedMorphology], _nv => {
  const soil = soilsampleMonthly.value
  if (soil && soil.months && soil.series) {
    monthlySeries.value = soil.series
    monthlyOptions.value = Object.assign({}, monthlyOptions.value || {}, { xaxis: { categories: soil.months }, chart: Object.assign({}, monthlyOptions.value?.chart || {}, { height: props.height }) })
    if (props.colors && Object.keys(props.colors).length > 0) monthlyOptions.value.colors = Object.values(props.colors)
  } else {
    const { series, options } = buildMonthlyChartData(totals.value)
    monthlySeries.value = series
    options.chart = Object.assign({}, options.chart || {}, { height: props.height })
    monthlyOptions.value = options
    if (props.colors && Object.keys(props.colors).length > 0) monthlyOptions.value.colors = Object.values(props.colors)
  }

  // ensure plotOptions.bar exists to avoid Apex runtime errors
  monthlyOptions.value = ensurePlotOptionsBar(monthlyOptions.value)
  try {
    // wrapper exposes inner chartRef via chartWrapper.value.chartRef
    const inner = chartWrapper.value?.chartRef

    // apply optional filter to show only one morphology series
    if (props.filterKey) {
      const fk = (props.filterKey || '').toString().toLowerCase()
      const found = (monthlySeries.value || []).find(s => (s.name || '').toString().toLowerCase().includes(fk))
      if (found) {
        void updateApexChart(inner, monthlyOptions.value, [found], true)
      } else {
        void updateApexChart(inner, monthlyOptions.value, monthlySeries.value, true)
      }
    } else {
      void updateApexChart(inner, monthlyOptions.value, monthlySeries.value, true)
    }
  } catch (error) {
    console.warn('MonthlyTrendChart: chart update failed', error)
  }
}, { immediate: true })

// fetch soilsamples (optionally for a single site) and aggregate counts by month
async function fetchSoilsamplesMonthly(siteId) {
  soilsampleMonthly.value = null
  soilsampleLoading.value = true
  try {
    // compute 12-month cutoff (start of month, 11 months back + current month = 12 months)
    const now = new Date()
    const cutoffMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    cutoffMonth.setMonth(cutoffMonth.getMonth() - 11)
    const cutoffIso = cutoffMonth.toISOString()

    // If siteId is provided, filter by site; otherwise fetch all soilsamples.
    // Also add a server-side filter to reduce payload when possible (date_collected >= cutoff)
    const baseFilter = { date_collected: { _gte: cutoffIso } }
    const query = siteId
      ? { filter: { _and: [{ site: { _eq: siteId } }, baseFilter] }, limit: -1 }
      : { filter: baseFilter, limit: -1 }

    const resp = await directus.request(readItems('soilsamples', query))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (!items || items.length === 0) return null

    const monthMap = new Map()

    function getCountField(item, keys) {
      for (const k of keys) if (item[k] != null) return Number(item[k] || 0)
      return 0
    }

    for (const s of items) {
      const dateRaw = s.date_collected || s.sample_date || s.date || null
      let d = null
      try {
        d = dateRaw ? new Date(dateRaw) : null
      } catch {
        d = null
      }
      if (!d || Number.isNaN(d.getTime())) continue
      // skip samples older than cutoff (defensive JS filter in case Directus filter didn't match field)
      if (d < cutoffMonth) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap.has(key)) monthMap.set(key, { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0, pellets: 0 })
      const agg = monthMap.get(key)
      agg.fragments += getCountField(s, ['fragment_count', 'fragments', 'fragmentCount'])
      agg.fibers += getCountField(s, ['fiber_count', 'fibers', 'fiberCount'])
      agg.foams += getCountField(s, ['foam_count', 'foams', 'foamCount'])
      agg.films += getCountField(s, ['film_count', 'films', 'filmCount'])
      agg.sheets += getCountField(s, ['sheets_count', 'sheet_count', 'sheets', 'sheetCount'])
      agg.pellets += getCountField(s, ['beads_count', 'pellets', 'beadsCount'])
    }

    const keys = Array.from(monthMap.keys()).toSorted()
    if (keys.length === 0) return null
    const months = keys.map(k => {
      const [y, m] = k.split('-')
      const date = new Date(Number(y), Number(m) - 1, 1)
      return date.toLocaleString(undefined, { month: 'short', year: 'numeric' })
    })

    const series = [
      { name: 'Fragments', data: keys.map(k => monthMap.get(k).fragments) },
      { name: 'Fibers', data: keys.map(k => monthMap.get(k).fibers) },
      { name: 'Foam', data: keys.map(k => monthMap.get(k).foams) },
      { name: 'Films', data: keys.map(k => monthMap.get(k).films) },
      { name: 'Sheets', data: keys.map(k => monthMap.get(k).sheets) },
      { name: 'Pellets', data: keys.map(k => monthMap.get(k).pellets) },
    ]

    soilsampleMonthly.value = { months, series }
    return soilsampleMonthly.value
  } catch (error) {
    console.error('MonthlyTrendChart: error fetching soilsamples', error)
    soilsampleMonthly.value = null
    return null
  } finally {
    soilsampleLoading.value = false
  }
}

// watch siteId and re-fetch soilsamples (if siteId is falsy, fetch all soilsamples)
watch(() => props.siteId, _nv => {
  void fetchSoilsamplesMonthly(_nv)
}, { immediate: true })
</script>

<template>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Total Monthly Microplastic Waste per Morphological Category</h3>
      <p class="subtitle">{{ subtitle || (props.date || defaultDate) }}</p>
    </div>
    <div v-if="soilsampleLoading"
      :style="{ minHeight: height + 'px', display: 'flex', justifyContent: 'center', alignItems: 'center' }">
      <VProgressCircular color="primary" indeterminate size="28" />
    </div>
    <div v-else>
      <ApexChartBase ref="chartWrapper" :height="height" :options="monthlyOptions" :series="monthlySeries"
        type="line" />
    </div>
  </div>
</template>

<style scoped>
.subtitle {
  color: rgb(155, 155, 155)
}
</style>
