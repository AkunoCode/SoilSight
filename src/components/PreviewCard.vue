<script setup>
/* eslint-disable unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument */
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useRouter } from 'vue-router'
import AISummary from '@/components/AISummary.vue'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'

import ApexChartBase from '@/components/graphs/ApexChartBase.vue'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
import MPPracticeBar from '@/components/graphs/MPPracticeBar.vue'
import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'
import MPSizeRangeAll from '@/components/graphs/MPSizeRangeAll.vue'
import SampledFarms from '@/components/SampledFarms.vue'

const props = defineProps({
  title: { type: String, required: false, default: 'SoilSight Analysis' },
  subtitle: { type: String, required: false, default: '' },
  item: { type: Object, required: false, default: null },
  isOverview: { type: Boolean, required: false, default: true },
  allFarmsData: { type: Array, required: false, default: () => [] },
})

const router = useRouter()
const app = useAppStore()
const { displayLatestSampleDate } = useLatestSampleDate()

// AISummary component handles AI summary fetching/generation UI
// it provides preview + full report dialog and generation controls

// --- DISPLAY FORMATTING ---
// local wrapper state if needed

// --- EXISTING CHART LOGIC ---
const computeOverviewTotals = computed(() => (
  props.allFarmsData.length === 0
    ? { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 }
    : (() => {
      return props.allFarmsData.reduce((acc, farm) => {
        acc.fragments += Number(farm.fragment_count) || 0
        acc.fibers += Number(farm.fiber_count) || 0
        acc.foams += Number(farm.foam_count) || 0
        acc.films += Number(farm.film_count) || 0
        acc.sheets += Number(farm.sheets_count || farm.sheet_count || farm.sheets) || 0
        /* pellets/beads removed from UI charts; keep bead counts if needed separately */
        return acc
      }, { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 })
    })()
))

const microplasticData = computed(() => (
  (props.item && !props.isOverview)
    ? {
      fragments: props.item.fragment_count || 0,
      fibers: props.item.fiber_count || 0,
      foams: props.item.foam_count || 0,
      films: props.item.film_count || 0,
      sheets: props.item.sheets_count || props.item.sheet_count || props.item.sheets || 0,
      /* pellets removed from microplastic vector used by charts */
    }
    : computeOverviewTotals.value
))

const displayTitle = computed(() => (props.item && !props.isOverview) ? (props.item.site_name || 'Farm Site Analysis') : props.title)

const displaySubtitle = computed(() => (props.item && !props.isOverview)
  ? `Owner: ${props.item.owner || 'Unknown'} | ${props.item.cultivation_practice || 'Unknown Practice'}`
  : (() => {
    const farmCount = props.allFarmsData.length
    const totalArea = props.allFarmsData.reduce((sum, farm) => sum + (farm.land_area_ha || 0), 0)
    return farmCount > 0 ? `${farmCount} Farms Analyzed | Total Area: ${totalArea.toFixed(2)} hectares` : props.subtitle
  })(),
)

const practiceKeys = ['conventional', 'organic', 'integrated']
const practiceNames = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']

function coerceCount(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const originalBarChartDataComputed = computed(() => {
  if (!Array.isArray(props.allFarmsData) || props.allFarmsData.length === 0) {
    return [
      { name: 'Conventional Practice', data: [0, 0, 0, 0, 0] },
      { name: 'Organic Practice', data: [0, 0, 0, 0, 0] },
      { name: 'Integrated Practice', data: [0, 0, 0, 0, 0] },
    ]
  }
  const accum = practiceKeys.map(() => [0, 0, 0, 0, 0])
  for (const farm of props.allFarmsData) {
    const practice = (farm.cultivation_practice || '').toString().toLowerCase()
    let idx = -1
    if (practice.includes('conventional')) idx = 0
    else if (practice.includes('organic')) idx = 1
    else if (practice.includes('integrated')) idx = 2
    else continue
    accum[idx][0] += coerceCount(farm.fragment_count)
    accum[idx][1] += coerceCount(farm.fiber_count)
    accum[idx][2] += coerceCount(farm.foam_count)
    accum[idx][3] += coerceCount(farm.film_count)
    accum[idx][4] += coerceCount(farm.sheets_count || farm.sheet_count || farm.sheets)
  }
  return practiceNames.map((name, i) => ({ name, data: accum[i] }))
})

const barChartDummySeries = ref(originalBarChartDataComputed.value)
watch(originalBarChartDataComputed, (nv) => { barChartDummySeries.value = nv })

function onDonutSelection(key) {
  try { app.setSelectedMorphology(key) } catch { }
  const keyToIndex = { fragments: 0, fibers: 1, foams: 2, films: 3, sheets: 4 }
  if (!key) {
    barChartDummySeries.value = originalBarChartDataComputed.value.slice()
    barChartOptions.value = { ...barChartOptions.value, xaxis: { categories: ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets'] } }
    return
  }
  const selectedIndex = keyToIndex[key]
  barChartDummySeries.value = originalBarChartDataComputed.value.map(series => ({ ...series, data: [series.data[selectedIndex]] }))
  barChartOptions.value = { ...barChartOptions.value, xaxis: { categories: [labelsMap[key]] } }
}

import { MP_COLOR_MAP } from '@/config/chartPalette.js'
const colors = { ...MP_COLOR_MAP }
const labelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foams', films: 'Films', sheets: 'Sheets' }

const barChartOptions = ref(getDefaultBarOptions(['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']))

const practiceMax = computed(() => {
  const series = originalBarChartDataComputed.value || []
  let max = 0
  for (const s of series) {
    for (const v of (s.data || [])) {
      const n = Number(v) || 0
      if (n > max) max = n
    }
  }
  return max
})

function formatNumberShort(val) {
  const v = Number(val) || 0
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(v)
}

function niceMaxValue(n) {
  if (!Number.isFinite(n) || n <= 0) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(n)))
  const norm = n / pow
  let r = 1
  if (norm <= 1) r = 1
  else if (norm <= 2) r = 2
  else if (norm <= 5) r = 5
  else r = 10
  return r * pow
}

function buildBarOptions() {
  const ymax = niceMaxValue(practiceMax.value)
  return getDefaultBarOptions(['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets'], {
    yaxis: { title: { text: 'Number of MP found' }, min: 0, max: ymax, labels: { formatter: (val) => formatNumberShort(val) } },
    tooltip: { y: { formatter: (val) => formatNumberShort(val) } },
  })
}

barChartOptions.value = buildBarOptions()
watch(practiceMax, () => { barChartOptions.value = buildBarOptions() })

// Dragging functionality
const isDragging = ref(false)
const cardPosition = ref(-80)
const hasMoved = ref(false)
const isAnimating = ref(false)
const dragStartY = ref(0)

function startDrag(event) {
  if (!event.target.closest('.drag-handle')) return
  isDragging.value = true
  hasMoved.value = false
  isAnimating.value = false
  dragStartY.value = event.clientY
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  event.preventDefault()
}

function onDrag(event) {
  if (!isDragging.value) return
  const deltaY = dragStartY.value - event.clientY
  const viewportHeight = window.innerHeight
  const deltaVh = (deltaY / viewportHeight) * 100
  if (Math.abs(deltaVh) > 0.5) hasMoved.value = true
  let newPosition = cardPosition.value + deltaVh
  newPosition = Math.max(-80, Math.min(-14, newPosition))
  cardPosition.value = newPosition
  dragStartY.value = event.clientY
}

function stopDrag() {
  if (isDragging.value && !hasMoved.value) {
    isAnimating.value = true
    togglePosition()
    setTimeout(() => { isAnimating.value = false }, 400)
  }
  isDragging.value = false
  hasMoved.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function togglePosition() {
  const currentPos = cardPosition.value
  const midPoint = (-80 + -14) / 2
  cardPosition.value = currentPos <= midPoint ? -14 : -80
}

function raiseCard() {
  isAnimating.value = true
  cardPosition.value = -14
  setTimeout(() => { isAnimating.value = false }, 400)
}

defineExpose({ raiseCard })

function expandInsight() {
  if (props.isOverview) {
    router.push('/insight/')
  } else if (props.item && props.item.site_name) {
    const farmName = encodeURIComponent(props.item.site_name)
    router.push(`/insight/${farmName}`)
  }
}
</script>

<template>
  <div ref="previewCard" :class="['preview-card', { 'no-transition': isDragging || !isAnimating }]" :style="{
    bottom: `${cardPosition}vh`,
    cursor: isDragging ? 'grabbing' : 'default'
  }">
    <div class="drag-handle" @mousedown="startDrag">
      <VIcon color="grey-darken-1" size="small">mdi-drag-horizontal</VIcon>
    </div>

    <div class="d-flex flex-column mb-4 card-header">
      <div class="d-flex align-center justify-space-between">
        <h3 class="title">{{ displayTitle }}</h3>
        <VIcon color="grey" size="large" @click="expandInsight">mdi-arrow-expand-all</VIcon>
      </div>
      <p v-if="displaySubtitle" class="subtitle">{{ displaySubtitle }}</p>
    </div>

    <div class="card-content">
      <div class="d-flex align-center mb-4">
        <MPDonutChart :active-key="app.selectedMorphology" :colors="colors" :labels-map="labelsMap"
          :microplastic-data="microplasticData" @selection="onDonutSelection" />
      </div>

      <div v-if="props.isOverview || !props.item" class="d-flex flex-column mt-4">
        <MPPracticeBar :options="barChartOptions" :series="barChartDummySeries"
          :subtitle="`Data as of ${displayLatestSampleDate}`" title="Contamination Comparison by Farm Practices" />
      </div>

      <div class="d-flex flex-column mt-4">
        <div class="d-flex flex-column">
          <AISummary :isOverview="props.isOverview" :item="props.item" :showGenerate="true" />
        </div>
      </div>

      <div v-if="props.isOverview">
        <h4 class="text-h6 font-weight-bold mt-6 mb-2" style="line-height: 1.2em;">
          Sampled Farms
        </h4>
        <SampledFarms :sampled-sites="allFarmsData" :show-map="false" />
      </div>
    </div>

    <!-- Regional intelligence dialog removed; AISummary includes its own dialog -->

  </div>
</template>

<style scoped>
.preview-card {
  position: fixed;
  right: 20px;
  background: white;
  padding: 1em 1.5em;
  border-radius: 1em 1em 0 0;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.385);
  width: 600px;
  z-index: 1000;
  user-select: none;
  transition: box-shadow 0.2s ease, bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-card.no-transition {
  transition: box-shadow 0.2s ease;
}

.preview-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
}

.drag-handle {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5em;
  margin: -1em -1.5em 1em -1.5em;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 1em 1em 0 0;
  cursor: grab;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s ease;
}

.drag-handle:hover {
  background: rgba(0, 0, 0, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
  background: rgba(0, 0, 0, 0.12);
}

.card-content {
  height: 85vh;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overflow-x: visible;
  padding-bottom: 10em;
}

.title {
  margin: 0;
  font-weight: bold;
  font-size: 2em;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1d50aa;
  padding: 1em;
  border-radius: 0em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.scrollable-summary {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
}

/* Formatting for Lists inside Summary */
.preserve-newlines {
  white-space: pre-wrap;
}

.preserve-newlines :deep(li) {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}

.report-content :deep(li) {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}
</style>