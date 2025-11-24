<script setup>
import { computed, ref, toRef, watch } from 'vue'
import { ensurePlotOptionsBar, updateApexChart } from '@/composables/useApexChart'
import ApexChartBase from './ApexChartBase.vue'

const props = defineProps({
  series: { type: Array, required: true },
  options: { type: Object, required: true },
  filterKey: { type: [String, null], default: null },
  title: { type: String, required: false, default: '' },
  subtitle: { type: String, required: false, default: '' },
  // optional human-readable date string to display
  date: { type: String, default: '' },
  height: { type: Number, default: 400 },
})

const seriesRef = toRef(props, 'series')
const optionsRef = toRef(props, 'options')

function getMorphIndexFromKey(key, labels) {
  if (!key) return -1
  const k = String(key).toLowerCase()
  const normalizedLabels = (labels || ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']).map(l => (l || '').toString().toLowerCase())
  // try exact match
  let idx = normalizedLabels.findIndex(l => l.includes(k) || k.includes(l))
  if (idx >= 0) return idx
  // fallback to simple mapping
  if (k.includes('fragment')) return 0
  if (k.includes('fiber') || k.includes('fibre')) return 1
  if (k.includes('foam')) return 2
  if (k.includes('film')) return 3
  if (k.includes('sheet')) return 4
  return -1
}

// wrapper ref (exposes inner chartRef)
const chartRef = ref(null)

// ensure plotOptions.bar exists to avoid Apex errors
const mergedOptionsSafe = computed(() => ensurePlotOptionsBar(mergedOptions.value))

// Apply a conservative default: if caller didn't specify bar dataLabel position
// we'll set it to 'top' and enable a small offset; otherwise respect caller options.
const mergedOptions = computed(() => {
  const base = optionsRef.value || {}

  // shallow copy of plotOptions so we can safely modify bar/dataLabels without deep merging
  const plotOptions = Object.assign({}, base.plotOptions || {})
  plotOptions.bar = Object.assign({}, plotOptions.bar || {})

  // If caller did not set a dataLabels position for bar, default to 'top'
  const callerBarDLPos = plotOptions.bar.dataLabels && plotOptions.bar.dataLabels.position
  if (!callerBarDLPos) {
    plotOptions.bar.dataLabels = Object.assign({}, plotOptions.bar.dataLabels || {}, { position: 'top' })
  }

  // If caller didn't provide a top-level dataLabels config, provide a sensible default
  const callerDL = base.dataLabels
  const dataLabels = callerDL || { enabled: true, style: { colors: ['#1f2937'], fontWeight: '600' } }

  // Return a shallow-merged options object; don't deep-merge caller's internals beyond the bar/dataLabels defaults above
  // Ensure toolbar is hidden by default unless caller explicitly sets it
  const chart = Object.assign({}, base.chart || {})
  if (!chart.toolbar) chart.toolbar = { show: false }
  // Ensure the options chart height follows the component `height` prop unless caller explicitly set height
  if (chart.height == null) chart.height = props.height

  return Object.assign({}, base, { chart, plotOptions, dataLabels })
})

// keep chart in sync without remounting
watch([seriesRef, mergedOptionsSafe, () => props.filterKey], _nv => {
  // compute filtered series and options depending on filterKey
  const filter = props.filterKey
  const opts = Object.assign({}, mergedOptionsSafe.value)
  let outSeries = seriesRef.value
  try {
    const labels = opts.xaxis && Array.isArray(opts.xaxis.categories) ? opts.xaxis.categories : ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']
    const idx = getMorphIndexFromKey(filter, labels)
    if (filter && idx >= 0) {
      // reduce each series to a single-value array for the selected morphology
      outSeries = seriesRef.value.map(s => ({ name: s.name, data: [(Array.isArray(s.data) ? (s.data[idx] || 0) : 0)] }))
      // update x-axis categories to the selected morphology label
      const label = (labels[idx] || filter)
      opts.xaxis = Object.assign({}, opts.xaxis || {}, { categories: [label] })
    }
  } catch {
    // fallback to original
    outSeries = seriesRef.value
  }

  const inner = chartRef.value?.chartRef
  if (inner) {
    void updateApexChart(inner, opts, outSeries, true)
  }
}, { immediate: true })
</script>

<template>
  <div class="d-flex flex-column">
    <h4 v-if="title" class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">{{ title }}</h4>
    <p v-if="subtitle || props.date" class="subtitle mb-2">{{ subtitle || props.date }}</p>
    <div>
      <ApexChartBase ref="chartRef" :height="height" :options="mergedOptionsSafe" :series="seriesRef" type="bar" />
    </div>
  </div>
</template>

<style scoped>
/* Minimal styles — previewCard supplies shared styles for consistency */

.subtitle {
  color: rgb(155, 155, 155);
}
</style>
