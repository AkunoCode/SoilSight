<script setup>
  import { computed, ref, watch } from 'vue'
  import { VIcon } from 'vuetify/components'
  import { ensurePlotOptionsBar, safeColorArray, updateApexChart } from '@/composables/useApexChart'
  import { useSampleDateStore } from '@/stores/sampleDate.js'
  import { CHART_COLORS } from '@/config/chartPalette.js'
  import ApexChartBase from './ApexChartBase.vue'

  const props = defineProps({
    categories: { type: Array, required: true },
    totals: { type: Array, required: true },
    drilldown: { type: [Object, Array], required: true },
    filterKey: { type: [String, null], default: null },
    title: { type: String, default: 'Overview' },
    categoryLabels: { type: Array, default: () => ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets'] },
    colors: { type: Object, default: () => ({}) },
    overviewColors: { type: Array, default: () => [] },
    useOverviewColors: { type: Boolean, default: false },
    height: { type: Number, default: 400 },
    date: { type: String, default: '' },
  })

  const siteNames = computed(() => props.categories || [])
  const totalBySite = computed(() => props.totals || [])
  const siteCategoryLabels = computed(() => props.categoryLabels)

  const sampleDateStore = useSampleDateStore()
  sampleDateStore.fetch()
  const { displayLatestSampleDate } = storeToRefs(sampleDateStore)
  const defaultDate = displayLatestSampleDate

  const overviewSeries = ref([{ name: 'Total MP', data: totalBySite.value }])
  const overviewOptions = ref({
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, height: props.height },
    xaxis: {
      categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value,
      type: 'category',
      labels: { rotate: -12, rotateAlways: false, hideOverlappingLabels: false, trim: false, style: { fontSize: '12px' } },
    },
    colors: [CHART_COLORS[2]],
    plotOptions: { bar: { horizontal: false } },
    legend: { position: 'top' },
  })

  // Preserve the initial overview colors so we can restore them when a filter is cleared
  const initialOverviewColors = safeColorArray(overviewOptions.value.colors || [CHART_COLORS[2]])

  function getMorphIndexFromKey (key) {
    if (!key) return -1
    const k = String(key).toLowerCase()
    if (k.includes('fragment')) return 0
    if (k.includes('fiber') || k.includes('fibre')) return 1
    if (k.includes('foam')) return 2
    if (k.includes('film')) return 3
    if (k.includes('sheet')) return 4
    return -1
  }

  function extractMorphValueForSite (detail, morphIdx) {
    if (!detail) return 0
    // detail may be array or object
    if (Array.isArray(detail)) return Number(detail[morphIdx] || 0)
    if (typeof detail === 'object') {
      if (Array.isArray(detail.drilldown)) return Number(detail.drilldown[morphIdx] || 0)
      // try keyed fields
      const keys = Object.keys(detail || {})
      // try several common key names
      const candidates = ['fragments', 'fibers', 'foam', 'films', 'sheets']
      const key = candidates[morphIdx] || null
      if (key && detail[key] != null) return Number(detail[key] || 0)
      // fallback to first numeric value
      for (const k of keys) {
        const v = Number(detail[k])
        if (!Number.isNaN(v)) return v
      }
    }
    return 0
  }

  if (props.useOverviewColors && props.overviewColors.length > 0) {
    overviewOptions.value.plotOptions = { bar: { horizontal: false, distributed: true } }
    overviewOptions.value.colors = safeColorArray(props.overviewColors)
  }

  const isDrilldown = ref(false)
  const currentSiteIndex = ref(null)
  const currentSiteName = ref('')

  const drilldownSeries = ref([])
  const drilldownOptions = ref({})

  const displayedSeries = computed(() => (isDrilldown.value ? drilldownSeries.value : overviewSeries.value))
  const displayedOptions = computed(() => (isDrilldown.value ? drilldownOptions.value : overviewOptions.value))

  // React to top-level filter (morphology key) to switch overview series to that morphology only
  watch(() => props.filterKey, async newKey => {
    try {
      const morphIdx = getMorphIndexFromKey(newKey)
      if (!newKey || morphIdx < 0) {
        // restore totals
        overviewSeries.value = [{ name: 'Total MP', data: totalBySite.value }]
        overviewOptions.value = Object.assign({}, overviewOptions.value, { xaxis: { categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value }, colors: initialOverviewColors })
      } else {
        // build per-site values from drilldown
        const values = (siteNames.value || []).map((_, idx) => {
          let details = []
          if (Array.isArray(props.drilldown)) details = props.drilldown[idx] || []
          else if (props.drilldown && typeof props.drilldown === 'object') details = props.drilldown[idx] || props.drilldown[siteNames.value[idx]] || props.drilldown
          return extractMorphValueForSite(details, morphIdx)
        })
        const label = (siteCategoryLabels.value && siteCategoryLabels.value[morphIdx]) || (newKey.charAt(0).toUpperCase() + newKey.slice(1))
        overviewSeries.value = [{ name: label, data: values }]
        // try to update options colors to use the single morphology color if provided
        let colors = overviewOptions.value.colors || [CHART_COLORS[2]]
        try {
          if (props.colors && Object.keys(props.colors).length > 0) {
            const keyNames = Object.keys(props.colors || {})
            const match = keyNames.find(k => k.toLowerCase().includes(newKey.toLowerCase()))
            if (match) colors = [props.colors[match]]
          }
        } catch {
        // ignore
        }
        overviewOptions.value = Object.assign({}, overviewOptions.value, { colors, xaxis: { categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value } })
      }

      // update chart in-place
      try {
        const inner = chartRef.value?.chartRef || chartRef.value
        await updateApexChart(inner, ensurePlotOptionsBar(displayedOptions.value), displayedSeries.value, true)
      } catch {
        chartKey.value += 1
      }
    } catch {
    // silent
    }
  }, { immediate: true })

  const chartRef = ref(null)
  // When using the ApexChartBase wrapper we store its component ref here
  // and read the inner apex instance as `chartRef.value.chartRef` when updating.
  const chartKey = ref(0)

  async function handleSiteClick (idx) {
    if (idx == null || idx < 0 || idx >= siteNames.value.length) return
    const name = siteNames.value[idx] || `Item ${idx + 1}`
    currentSiteIndex.value = idx
    currentSiteName.value = name

    let details = []
    // Accept multiple drilldown shapes:
    // - Array of arrays: [ [frag,fiber,...], [..] ]
    // - Array of objects: [ { fragments: 1, fibers: 2, ... }, ... ]
    // - Object keyed by category name: { 'Gray': [..], 'Blue': [..] } or { 'Gray': { fragments:.. } }
    if (Array.isArray(props.drilldown)) {
      details = props.drilldown[idx] || []
    } else if (props.drilldown && typeof props.drilldown === 'object') {
      details = props.drilldown[name] || props.drilldown[idx] || props.drilldown
    }

    // incoming shapes are accepted and normalized below

    // Normalize `details` into an array of numbers matching siteCategoryLabels
    let siteData = []
    if (Array.isArray(details)) {
      // Two common shapes:
      //  - an array of numbers: [frag, fiber, ...]
      //  - an array where the first element is an object: [{ fragments: 1, fibers: 2, ... }] (rare)
      if (details.length > 0 && typeof details[0] === 'object' && !Array.isArray(details[0])) {
        // try to map from the first object's keys
        const first = details[0] || {}
        const keys = Object.keys(first)
        siteData = siteCategoryLabels.value.map(lbl => {
          const lower = (lbl || '').toString().toLowerCase()
          const match = keys.find(k => k.toLowerCase() === lower || k.toLowerCase() === lower + 's' || (k.toLowerCase() || '').startsWith(lower))
          return Number(first[match] || first[lower] || 0)
        })
      } else {
        // assume an array of numbers aligned by index
        siteData = siteCategoryLabels.value.map((_, i) => Number(details[i] || 0))
      }
    } else if (details && typeof details === 'object') {
      // details could be { fragments: 1, fibers: 2, ... } or { drilldown: [..] }
      if (Array.isArray(details.drilldown)) {
        siteData = siteCategoryLabels.value.map((_, i) => Number(details.drilldown[i] || 0))
      } else {
        // map by label keys (case-insensitive, singular/plural tolerant)
        const keys = Object.keys(details || {})
        siteData = siteCategoryLabels.value.map(lbl => {
          const lower = (lbl || '').toString().toLowerCase()
          // try to find matching key by relaxed matching
          const match = keys.find(k => k.toLowerCase() === lower || k.toLowerCase() === lower + 's' || (k.toLowerCase() || '').startsWith(lower))
          return Number(details[match] || details[lower] || 0)
        })
      }
    } else {
      // fallback: zeros
      siteData = siteCategoryLabels.value.map(() => 0)
    }

    // If normalization produced zeros while the overview total is non-zero, attempt a silent fallback
    try {
      const sum = siteData.reduce((a, b) => a + (Number(b) || 0), 0)
      const overviewTotal = Number(totalBySite.value[idx] || 0)
      if (overviewTotal > 0 && sum === 0) {
        try {
          const alt = Array.isArray(details) ? Object.values(details).map(v => Number(v || 0)) : Object.values(details || {}).map(v => Number(v || 0))
          const altSum = alt.reduce((a, b) => a + (Number(b) || 0), 0)
          if (altSum > 0) {
            // use the extracted alt values aligned to category labels (pad/truncate as necessary)
            siteData = siteCategoryLabels.value.map((_, i) => Number(alt[i] || 0))
          }
        } catch {
        // ignore fallback errors
        }
      }
    } catch {
    // ignore
    }

    drilldownSeries.value = [{ name: currentSiteName.value, data: siteData }]

    const drillPlotOpts = (props.colors && Object.keys(props.colors).length > 0) ? { bar: { horizontal: false, distributed: true } } : { bar: { horizontal: false } }

    drilldownOptions.value = {
      chart: { type: 'bar', toolbar: { show: false }, height: props.height },
      xaxis: { categories: Array.isArray(siteCategoryLabels.value) ? siteCategoryLabels.value.slice() : siteCategoryLabels.value, type: 'category' },
      plotOptions: drillPlotOpts,
      legend: { show: false },
    }

    if (props.colors && Object.keys(props.colors).length > 0) {
      const keys = Object.keys(props.colors || {})
      const safeColor = c => (c && typeof c === 'string') ? c : '#9e9e9e'
      const colorsArr = siteCategoryLabels.value.map(label => {
        const lower = (label || '').toLowerCase()
        const candidates = [lower, lower + 's']
        if (lower.endsWith('s')) candidates.push(lower.slice(0, -1))
        candidates.push(label)
        for (const c of candidates) {
          const matchKey = keys.find(k => k.toLowerCase() === (c || '').toLowerCase())
          if (matchKey) return safeColor(props.colors[matchKey])
        }
        return '#9e9e9e'
      })
      drilldownOptions.value.colors = safeColorArray(colorsArr)
    }

    // try updating chart in-place; fall back to remount if update fails
    const opts = ensurePlotOptionsBar({ xaxis: drilldownOptions.value.xaxis, plotOptions: drilldownOptions.value.plotOptions, legend: drilldownOptions.value.legend, colors: drilldownOptions.value.colors })
    try {
      const inner = chartRef.value?.chartRef || chartRef.value
      const ok = await updateApexChart(inner, opts, drilldownSeries.value, true)
      if (!ok) throw new Error('update failed')
      isDrilldown.value = true
    } catch (error) {
      // remount fallback
      console.warn('ApexChart update failed', error)
      isDrilldown.value = true
      chartKey.value += 1
    }
  }
  async function resetSiteDrilldown () {
    // attempt in-place update back to overview
    const opts = ensurePlotOptionsBar({ xaxis: overviewOptions.value.xaxis, plotOptions: overviewOptions.value.plotOptions, colors: overviewOptions.value.colors, legend: overviewOptions.value.legend })
    try {
      const inner = chartRef.value?.chartRef || chartRef.value
      const ok = await updateApexChart(inner, opts, overviewSeries.value, true)
      if (!ok) throw new Error('update failed')
    } catch (error) {
      console.warn('ApexChart update failed', error)
      chartKey.value += 1
    }
    isDrilldown.value = false
    currentSiteIndex.value = null
    currentSiteName.value = ''
  }

  overviewOptions.value.chart.events = {
    dataPointSelection (_, __, config) {
      if (!isDrilldown.value) handleSiteClick(config.dataPointIndex)
    },
  }

  watch([() => props.categories, () => props.totals], async () => {
    overviewSeries.value = [{ name: 'Total MP', data: totalBySite.value }]
    overviewOptions.value.xaxis = { categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value, type: 'category' }
    if (!overviewOptions.value.plotOptions) overviewOptions.value.plotOptions = { bar: { horizontal: false } }
    // update chart in-place when possible
    const opts = ensurePlotOptionsBar({ xaxis: overviewOptions.value.xaxis, plotOptions: overviewOptions.value.plotOptions, colors: overviewOptions.value.colors, legend: overviewOptions.value.legend })
    try {
      const inner = chartRef.value?.chartRef || chartRef.value
      const ok = await updateApexChart(inner, opts, overviewSeries.value, true)
      if (!ok) throw new Error('update failed')
    } catch (error) {
      console.warn('ApexChart update failed', error)
      chartKey.value += 1
    }
  })
</script>

<template>
  <div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 v-if="!isDrilldown">{{ title }}</h3>
      <h3 v-else style="cursor:pointer; display:flex; align-items:center; gap:8px;" @click="resetSiteDrilldown">
        <VIcon color="grey" style="line-height:1;">mdi-menu-left</VIcon>
        <span>Counts for {{ currentSiteName }}</span>
      </h3>
      <p class="subtitle">{{ props.date || defaultDate }}</p>
    </div>
    <ApexChartBase
      :key="chartKey"
      ref="chartRef"
      :height="props.height"
      :options="displayedOptions"
      :remount-key="chartKey"
      :series="displayedSeries"
      type="bar"
    />
  </div>
</template>

<style scoped>
.subtitle {
  color: rgb(155, 155, 155);
}
</style>
