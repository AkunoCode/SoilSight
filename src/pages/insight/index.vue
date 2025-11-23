<script setup>
/* eslint-disable unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument */
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useRouter } from 'vue-router'
import directus from '@/composables/useDirectus.js'
import { readItems, createItem } from '@directus/sdk'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'

import ApexChartBase from '@/components/graphs/ApexChartBase.vue'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
import MPPracticeBar from '@/components/graphs/MPPracticeBar.vue'
import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'
import MPSizeRangeAll from '@/components/graphs/MPSizeRangeAll.vue'
import SampledFarms from '@/components/SampledFarms.vue'

const router = useRouter()
const app = useAppStore()
const { displayLatestSampleDate, fetchLatestSampleDate } = useLatestSampleDate()

// --- STATE ---
const sites = ref([])
const loading = ref(false)
const error = ref(null)

// --- REGIONAL REPORT LOGIC START ---
const showReportDialog = ref(false)
const regionalReport = ref(null)
const isGeneratingReport = ref(false)
let pollInterval = null

// 1. Parse Markdown for the FULL report (Dialog)
const parsedRegionalReport = computed(() => {
  if (!regionalReport.value?.ai_report) return ''
  return regionalReport.value.ai_report
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\n/g, '<br>') // Newlines
    .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>') // Bullets
})

// 2. Create a Text Preview for the Card (Strip markdown)
const reportPreview = computed(() => {
  if (!regionalReport.value?.ai_report) return ''
  let raw = regionalReport.value.ai_report.replace(/\*\*/g, '').replace(/[#*-]/g, '')
  // Increased length to show more context as requested
  return raw.length > 1000 ? raw.substring(0, 1000) + '...' : raw
})

const reportDateLabel = computed(() => {
  if (regionalReport.value?.report_date) {
    return new Date(regionalReport.value.report_date).toLocaleDateString()
  }
  return 'No report available'
})

async function fetchRegionalReport() {
  try {
    const res = await directus.request(readItems('general_summary', {
      sort: ['-report_date'],
      limit: 1
    }))
    const items = Array.isArray(res) ? res : (res?.data || [])
    if (items.length > 0) {
      regionalReport.value = items[0]
      if (isGeneratingReport.value && items[0].ai_report && items[0].ai_report.length > 10) {
        isGeneratingReport.value = false
        stopPolling()
      }
    }
  } catch (e) {
    console.error('Error fetching regional report', e)
  }
}

async function triggerReportGeneration() {
  isGeneratingReport.value = true
  try {
    await directus.request(createItem('general_summary', { ai_report: '' }))
    startPolling()
  } catch (e) {
    console.error('Failed to trigger generation', e)
    isGeneratingReport.value = false
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(() => { fetchRegionalReport() }, 5000)
}

function stopPolling() {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = null
}

onUnmounted(() => { stopPolling() })
// --- REGIONAL REPORT LOGIC END ---

async function loadSites() {
  loading.value = true
  error.value = null
  try {
    const resp = await directus.request(readItems('sites', { fields: ['*'], limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    sites.value = items || []
  } catch (err) {
    error.value = err
    console.error('Failed to load sites from Directus', err)
  } finally {
    loading.value = false
  }
}

// --- METRICS ---
const totalFragments = computed(() => sites.value.reduce((s, r) => s + (Number(r.fragment_count) || 0), 0))
const totalFibers = computed(() => sites.value.reduce((s, r) => s + (Number(r.fiber_count) || 0), 0))
const totalFoams = computed(() => sites.value.reduce((s, r) => s + (Number(r.foam_count) || 0), 0))
const totalFilms = computed(() => sites.value.reduce((s, r) => s + (Number(r.film_count) || 0), 0))
const totalPellets = computed(() => sites.value.reduce((s, r) => s + (Number(r.beads_count) || 0), 0))
const totalSheets = computed(() => sites.value.reduce((s, r) => s + (Number(r.sheets_count) || Number(r.sheet_count) || Number(r.sheets) || 0), 0))

const microplasticData = computed(() => ({
  fragments: totalFragments.value,
  fibers: totalFibers.value,
  foams: totalFoams.value,
  films: totalFilms.value,
  sheets: totalSheets.value,
  pellets: totalPellets.value,
}))

const mpColors = { fragments: '#0B2E4E', fibers: '#19568E', films: '#63B3FF', foams: '#4688C7', sheets: '#8AB4FF', pellets: '#B9DDFF' }
const donutColors = { ...mpColors }
const donutLabelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets', pellets: 'Pellets' }

function handleLegendClick(key) {
  app.toggleSelectedMorphology(key)
}

// --- CHARTS (Drilldowns) ---
const inputTypes = [
  'Fertilizer Sacks',
  'Plastic Mulching',
  'Seedling Trays',
  'Compost with Plastic',
  'Greenhouse Plastic Sheet',
]
function siteHasActivity(site, expected) {
  if (!site || !site.plastic_activity) return false
  const raw = site.plastic_activity
  const expectedNorm = (expected || '').toString().toLowerCase().trim()
  if (Array.isArray(raw)) return raw.some(x => String(x).toLowerCase().includes(expectedNorm))
  return String(raw).toLowerCase().includes(expectedNorm)
}
const inputTotals = computed(() => inputTypes.map(type => sites.value.reduce((acc, s) => {
  if (!siteHasActivity(s, type)) return acc
  return acc + ((Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.beads_count) || 0) + (Number(s.sheets_count) || 0))
}, 0)))
const inputDrilldown = computed(() => inputTypes.map(type => {
  return sites.value.reduce((acc, s) => {
    if (!siteHasActivity(s, type)) return acc
    acc[0] += (Number(s.fragment_count) || 0)
    acc[1] += (Number(s.fiber_count) || 0)
    acc[2] += (Number(s.foam_count) || 0)
    acc[3] += (Number(s.film_count) || 0)
    acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || 0)
    acc[5] += (Number(s.beads_count) || 0)
    return acc
  }, [0, 0, 0, 0, 0, 0])
}))

function sanitizeSiteName(name) {
  return String(name || '').replace(/\b[Ff]arm\b/g, '').replace(/[\-–—_/]+/g, ' ').trim().replace(/^[,\s]+|[,\s]+$/g, '')
}
const siteCategories = computed(() => sites.value.map(s => sanitizeSiteName(s.site_name)))
const siteTotals = computed(() => sites.value.map(s => (Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.sheets_count) || 0) + (Number(s.beads_count) || 0)))
const siteDrilldown = computed(() => sites.value.map(s => [(Number(s.fragment_count) || 0), (Number(s.fiber_count) || 0), (Number(s.foam_count) || 0), (Number(s.film_count) || 0), (Number(s.sheets_count) || 0), (Number(s.beads_count) || 0)]))

const numOrganic = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('organic')).length)
const numConventional = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('conventional')).length)
const numIntegrated = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('integrated')).length)

const categoriesForPracticeChart = ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']
const practiceNames = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']
const practiceKeys = ['conventional', 'organic', 'integrated']

const contaminationByPracticeSeries = computed(() => {
  return practiceNames.map((name, i) => {
    const key = practiceKeys[i]
    const filteredSites = sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(key))
    return {
      name,
      data: [
        filteredSites.reduce((a, b) => a + (Number(b.fragment_count) || 0), 0),
        filteredSites.reduce((a, b) => a + (Number(b.fiber_count) || 0), 0),
        filteredSites.reduce((a, b) => a + (Number(b.foam_count) || 0), 0),
        filteredSites.reduce((a, b) => a + (Number(b.film_count) || 0), 0),
        filteredSites.reduce((a, b) => a + (Number(b.sheets_count) || 0), 0),
        filteredSites.reduce((a, b) => a + (Number(b.beads_count) || 0), 0)
      ]
    }
  })
})

const allVals = computed(() => contaminationByPracticeSeries.value.flatMap(s => s.data))
const maxVal = computed(() => (allVals.value.length > 0 ? Math.max(...allVals.value) : 700))
const contaminationByPracticeOptions = computed(() => getDefaultBarOptions(categoriesForPracticeChart, {
  chart: { type: 'bar' },
  legend: { position: 'bottom' },
  yaxis: { title: { text: 'Count' }, min: 0, max: Math.ceil(maxVal.value * 1.1) }
}))

const textures = computed(() => Array.from(new Set(sites.value.map(s => s.soil_type || 'Unknown'))))
const textureTotals = computed(() => textures.value.map(t => sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
  return acc + ((Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.sheets_count) || 0) + (Number(s.beads_count) || 0))
}, 0)))
const textureDrilldown = computed(() => textures.value.map(t => {
  const vals = sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
    acc[0] += (Number(s.fragment_count) || 0)
    acc[1] += (Number(s.fiber_count) || 0)
    acc[2] += (Number(s.foam_count) || 0)
    acc[3] += (Number(s.film_count) || 0)
    acc[4] += (Number(s.sheets_count) || 0)
    acc[5] += (Number(s.beads_count) || 0)
    return acc
  }, [0, 0, 0, 0, 0, 0])
  return vals
}))

// --- ADVANCED CHARTS: COLOR & SIZE ---
const colorComparisonAll = ref(null)
const colorComparisonLoading = ref(false)
const sizeComparisonAll = ref(null) // Holds aggregated size data
const selectedSizeField = ref('equivalent_circular_diameter_um') // Bound to child component via props if needed, or handled internally by child

function morphologyIndex(morph) {
  const m = (morph || '').toString().toLowerCase()
  if (m.includes('fragment')) return 0
  if (m.includes('fiber')) return 1
  if (m.includes('foam')) return 2
  if (m.includes('film')) return 3
  if (m.includes('sheet')) return 4
  if (m.includes('pellet')) return 5
  return -1
}

// 1. FETCH COLORS
async function fetchColorComparisonAllSites() {
  colorComparisonLoading.value = true
  try {
    const resp = await directus.request(readItems('microplastics', { limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (!items.length) {
      colorComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
      return
    }

    const counts = new Map()
    const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'

    for (const it of items) {
      const rawColor = it.color || 'unknown'
      const norm = normKey(rawColor)
      if (!counts.has(norm)) counts.set(norm, { count: 0, display: rawColor, drilldown: [0, 0, 0, 0, 0, 0] })

      const obj = counts.get(norm)
      const amount = Number(it.count || 1)
      obj.count += amount

      const midx = morphologyIndex(it.shape)
      if (midx >= 0) obj.drilldown[midx] += amount
    }

    const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 12)

    colorComparisonAll.value = {
      categories: arr.map(x => x.display),
      totals: arr.map(x => x.count),
      drilldown: arr.map(x => x.drilldown),
      overviewColors: arr.map((_, i) => `hsl(${220 - (i * 20)}, 60%, 45%)`)
    }
  } catch (e) { console.error(e) }
  finally { colorComparisonLoading.value = false }
}

// 2. FETCH SIZES (The missing piece)
// Helper helpers
function toNumber(v) { if (v == null || v === '') return NaN; const n = Number(v); return Number.isNaN(n) ? NaN : n }
function areaToDiameter(area) { if (!Number.isFinite(area) || area <= 0) return NaN; return 2 * Math.sqrt(area / Math.PI) }

async function fetchSizeComparisonAllSites(fieldKey = 'equivalent_circular_diameter_um') {
  try {
    const resp = await directus.request(readItems('microplastics', { limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])

    if (!items.length) {
      sizeComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
      return
    }

    const buckets = [
      { label: '1-20 µm', min: 1, max: 20 },
      { label: '20-100 µm', min: 20, max: 100 },
      { label: '100-500 µm', min: 100, max: 500 },
      { label: '500 µm-1 mm', min: 500, max: 1000 },
      { label: '1-5 mm', min: 1000, max: 5000 }
    ]

    const totals = new Array(buckets.length).fill(0)
    const drilldown = new Array(buckets.length).fill(0).map(() => [0, 0, 0, 0, 0, 0])
    let unknownTotal = 0
    let unknownDrill = [0, 0, 0, 0, 0, 0]

    for (const it of items) {
      const amount = Number(it.count || 1)
      let val = toNumber(it[fieldKey])

      // Fallback to parsing text field if numeric field is empty
      if (Number.isNaN(val) && it.size) {
        const s = it.size.toLowerCase()
        const num = parseFloat(s)
        if (!Number.isNaN(num)) {
          if (s.includes('mm')) val = num * 1000
          else val = num // assume um
        }
      }

      if (fieldKey === 'area_um2' && Number.isFinite(val)) val = areaToDiameter(val)

      let bIdx = -1
      if (Number.isFinite(val)) {
        for (let i = 0; i < buckets.length; i++) {
          if (val >= buckets[i].min && val < buckets[i].max) { bIdx = i; break; }
        }
      }

      const midx = morphologyIndex(it.shape)

      if (bIdx >= 0) {
        totals[bIdx] += amount
        if (midx >= 0) drilldown[bIdx][midx] += amount
      } else {
        unknownTotal += amount
        if (midx >= 0) unknownDrill[midx] += amount
      }
    }

    const categories = buckets.map(b => b.label)
    // Optionally add 'Other' bucket if significant
    // if(unknownTotal > 0) { categories.push('Unknown'); totals.push(unknownTotal); drilldown.push(unknownDrill); }

    sizeComparisonAll.value = {
      categories,
      totals,
      drilldown,
      overviewColors: categories.map(() => '#1976D2') // Simple color
    }

  } catch (e) {
    console.error("Size fetch error", e)
    sizeComparisonAll.value = null
  }
}

// Watch for field changes to re-fetch size data
watch(selectedSizeField, (newVal) => {
  fetchSizeComparisonAllSites(newVal)
})


// --- CROPS & SIZES ---
const cropCounts = computed(() => {
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
  return counts
})
const topCrops = computed(() => Object.entries(cropCounts.value).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => ({ crop: c.charAt(0).toUpperCase() + c.slice(1), count: n })))

const farmSizeCounts = computed(() => ({
  small: sites.value.filter(s => s.land_area_ha < 1).length,
  medium: sites.value.filter(s => s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
  large: sites.value.filter(s => s.land_area_ha > 3).length,
}))
const farmSizeSeries = computed(() => ([{ name: 'Farms', data: [farmSizeCounts.value.small, farmSizeCounts.value.medium, farmSizeCounts.value.large] }]))
const farmSizeOptions = computed(() => ({ chart: { type: 'bar', toolbar: { show: false } }, xaxis: { categories: ['Small (<1ha)', 'Medium (1-3ha)', 'Large (>3ha)'] }, plotOptions: { bar: { horizontal: false, columnWidth: '70%' } }, legend: { show: false } }))

function printReport() { window.print() }

onMounted(async () => {
  fetchRegionalReport()
  try {
    app.startLoading()
    await loadSites()
    try { await fetchLatestSampleDate() } catch { }
    try { await fetchColorComparisonAllSites() } catch { }
    // Initial size fetch
    try { await fetchSizeComparisonAllSites(selectedSizeField.value) } catch { }
  } finally {
    try { app.finishLoading() } catch { }
  }
})
</script>

<template>
  <div class="insight-page">
    <header class="page-header">
      <div class="d-flex align-center">
        <VIcon color="grey" size="x-large" style="cursor:pointer; vertical-align:middle;" @click="$router.back()">
          mdi-menu-left</VIcon>
        <h1>Tayabas City, Quezon Province, Philippines</h1>
      </div>
    </header>

    <div class="columns">
      <div class="kpi">
        <div class="kpi-num">{{ sites.length }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Number of Sampled Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numOrganic }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Organic Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numConventional }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Conventional Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numIntegrated }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Integrated Farms</div>
      </div>
      <div class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
        style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
        <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
        <p class="text-h4 text-white font-weight-bold">Print Report</p>
      </div>
    </div>

    <VRow class="mt-2">
      <VCol class="d-flex flex-column justify-space-between" cols="3">
        <div class="card crops-card" style="height: 38%;">
          <h3>Most Common Crops Grown</h3>
          <ul class="crop-list">
            <li v-for="c in topCrops" :key="c.crop">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="crop-name">{{ c.crop }}</span>
              </div>
            </li>
          </ul>
        </div>
        <div class="card" style="height: 58%;">
          <h3>Size Distribution of Sampled Farms</h3>
          <ApexChartBase :height="230" :options="farmSizeOptions" :series="farmSizeSeries" type="bar" />
        </div>
      </VCol>

      <VCol cols="4">
        <div class="card">
          <MPDonutChart :height="360" :active-key="app.selectedMorphology" :colors="donutColors"
            :labels-map="donutLabelsMap" :microplastic-data="microplasticData" @selection="handleLegendClick" />
        </div>
      </VCol>

      <VCol cols="5">
        <div class="card">
          <SiteDrilldownChart :categories="siteCategories"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="siteDrilldown" :height="425" title="Microplastic Count by Farm Site" :totals="siteTotals"
            :filter-key="app.selectedMorphology" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="6">
        <div class="card">
          <MPPracticeBar :height="400" :options="contaminationByPracticeOptions" :series="contaminationByPracticeSeries"
            :subtitle="`Data as of ${displayLatestSampleDate}`" title="Contamination Comparison by Farm Practices"
            :filter-key="app.selectedMorphology" />
        </div>
      </VCol>
      <VCol cols="6">
        <MonthlyTrendChart :height="340" :colors="mpColors" :microplastic-data="microplasticData"
          :subtitle="`Data as of ${displayLatestSampleDate}`" :filter-key="app.selectedMorphology" />
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="7">
        <div class="card">
          <SiteDrilldownChart :categories="inputTypes"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="inputDrilldown" title="Microplastic Counts by Plastic-Related Farm Inputs" :totals="inputTotals"
            :height="300" :filter-key="app.selectedMorphology" />
        </div>
      </VCol>
      <VCol cols="5">
        <div class="card">
          <SiteDrilldownChart :categories="textures"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="textureDrilldown" title="Microplastic Count by Soil Texture" :totals="textureTotals"
            :filter-key="app.selectedMorphology" :height="300" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol class="d-flex flex-column justify-space-between" cols="6">
        <div class="card bottom-card">
          <template v-if="colorComparisonLoading">
            <div :style="{ minHeight: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center' }">
              <VProgressCircular color="primary" indeterminate size="28" />
            </div>
          </template>
          <template v-else-if="colorComparisonAll && colorComparisonAll.totals && colorComparisonAll.totals.length > 0">
            <SiteDrilldownChart :categories="colorComparisonAll.categories"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
              :drilldown="colorComparisonAll.drilldown" :height="250" title="Microplastic Count by Color"
              :totals="colorComparisonAll.totals" :filter-key="app.selectedMorphology" />
          </template>
          <template v-else>
            <div style="padding: 20px; text-align:center; color: #666;">
              <p style="margin:0; font-weight:600">Microplastic Count by Color</p>
              <p style="margin:8px 0 0;">No color aggregation data available yet.</p>
            </div>
          </template>
        </div>

        <div class="card bottom-card">
          <template
            v-if="sizeComparisonAll && Array.isArray(sizeComparisonAll.totals) && sizeComparisonAll.totals.reduce((a, b) => a + b, 0) > 0">
            <MPSizeRangeAll :height="220" title="Microplastic Count by Size Range" :filter-key="app.selectedMorphology"
              :external-data="sizeComparisonAll" @update:field="val => selectedSizeField = val" />
          </template>
          <template v-else>
            <div style="padding: 20px; text-align:center; color: #666;">
              <p style="margin:0; font-weight:600">Microplastic Count by Size Range</p>
              <p style="margin:8px 0 0;">No size data found in microplastics table.</p>
            </div>
          </template>
        </div>

        <div class="card bottom-card">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="d-flex align-center">
              <h3>AI Insights</h3>
              <VIcon class="ml-2" color="blue">mdi-creation</VIcon>
            </div>
            <VChip v-if="isGeneratingReport" size="small" color="warning" variant="outlined">
              <VProgressCircular indeterminate size="14" width="2" class="mr-2" />
              Analyzing...
            </VChip>
          </div>

          <p class="subtitle mb-2">{{ reportDateLabel }}</p>

          <div class="summary-box d-flex flex-column justify-center align-start" style="min-height: 120px;">
            <template v-if="isGeneratingReport">
              <div class="w-100 text-center py-4">
                <p class="text-grey mb-0">Aggregating regional data...</p>
                <p class="text-caption text-grey-lighten-1">This takes about 20 seconds.</p>
              </div>
            </template>

            <template v-else-if="regionalReport">
              <p class="text-body-2 text-grey-darken-3 text-left w-100 px-2 mb-4 report-preview">
                {{ reportPreview }}
              </p>
              <div class="w-100 text-center">
                <VBtn color="primary" variant="flat" @click="showReportDialog = true"
                  prepend-icon="mdi-book-open-page-variant">
                  Read Full Report
                </VBtn>
              </div>
            </template>

            <template v-else>
              <div class="w-100 text-center py-4">
                <p class="text-body-2 text-grey mb-4">No regional analysis available.</p>
                <VBtn color="primary" variant="outlined" @click="triggerReportGeneration">
                  Generate Analysis
                </VBtn>
              </div>
            </template>
          </div>
        </div>
      </VCol>

      <VCol cols="6">
        <div class="card list-card map-card">
          <h3 class="mb-2">Sampled Farms</h3>
          <SampledFarms :sampled-sites="sites" />
        </div>
      </VCol>
    </VRow>

    <VDialog v-model="showReportDialog" max-width="800" scrollable>
      <VCard>
        <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-grey-lighten-4">
          <div class="d-flex align-center">
            <VIcon color="primary" class="mr-2">mdi-google-analytics</VIcon>
            <span class="text-h6 font-weight-bold">Regional Intelligence Report</span>
          </div>
          <VBtn icon="mdi-close" variant="text" @click="showReportDialog = false"></VBtn>
        </VCardTitle>
        <VDivider></VDivider>

        <VCardText class="pa-6" style="min-height: 300px;">
          <div v-if="regionalReport" class="text-body-1">
            <div class="d-flex gap-4 mb-6">
              <VChip color="primary" label>{{ new Date(regionalReport.report_date).toLocaleDateString() }}</VChip>
              <VChip variant="outlined"><strong>{{ regionalReport.total_farms_analyzed }}</strong>&nbsp;Farms</VChip>
              <VChip variant="outlined" color="red"><strong>{{ regionalReport.total_pollution_count
              }}</strong>&nbsp;Particles</VChip>
            </div>
            <div class="report-content" v-html="parsedRegionalReport"></div>
          </div>
        </VCardText>

        <VDivider></VDivider>
        <VCardActions class="pa-4">
          <VSpacer></VSpacer>
          <VBtn variant="text" color="primary" prepend-icon="mdi-refresh" @click="triggerReportGeneration">Regenerate
          </VBtn>
          <VBtn color="primary" variant="elevated" @click="showReportDialog = false">Close</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

  </div>
</template>

<style scoped>
.insight-page {
  padding: 2em;
  background-color: #f2f2f8;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: var(--v-theme-on-surface);
  opacity: 0.8;
}

.subtitle {
  color: rgb(155, 155, 155);
}

.columns {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  flex-wrap: wrap;
}

.kpi {
  display: flex;
  gap: 20px;
  align-items: center;
  background: white;
  padding: 12px 32px;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
}

.kpi-num {
  font-size: 32px;
  font-weight: 700;
}

.v-separator {
  width: 3px;
  height: 80%;
  background-color: rgba(0, 0, 0, 0.1);
}

.kpi-body {
  font-size: 20px;
  font-weight: 700;
  line-height: 110%;
  color: rgba(0, 0, 0, 0.7);
}

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
  height: 100%;
}

.bottom-card {
  min-height: 320px;
}

.bottom-card:not(:first-of-type) {
  margin-top: 1.3em;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1976d2;
  padding: 12px 16px;
  margin-top: 8px;
}

.report-preview {
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.report-content {
  line-height: 1.6;
  color: #333;
}

.report-content :deep(li) {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}

.crop-list {
  margin: 0;
  columns: 2;
  column-gap: 18px;
  list-style: none;
}

.crop-list li {
  color: rgba(0, 0, 0, 0.85);
  break-inside: avoid-column;
}

@media (max-width: 900px) {
  .columns {
    flex-direction: column;
  }

  .crop-list {
    columns: 1;
  }
}
</style>