<script setup>
import L from 'leaflet'
import { computed, onMounted, ref, watch } from 'vue'
import dummy from '@/assets/dummyData.json'
import 'leaflet/dist/leaflet.css'
import MPPracticeBar from '@/components/graphs/MPPracticeBar.vue'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'

// Simple derived metrics
const sites = dummy.sites || []

const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

// Pie: composition of microplastic categories (sum across sites)
const totalFragments = sites.reduce((s, r) => s + (r.fragment_count || 0), 0)
const totalFibers = sites.reduce((s, r) => s + (r.fiber_count || 0), 0)
const totalFoams = sites.reduce((s, r) => s + (r.foam_count || 0), 0)
const totalFilms = sites.reduce((s, r) => s + (r.film_count || 0), 0)
const totalPellets = sites.reduce((s, r) => s + (r.beads_count || 0), 0)

const compositionSeries = ref([totalFragments, totalFibers, totalFoams, totalFilms, totalPellets])

// Richer composition data and interactive legend (reuse PreviewCard style)
const microplasticData = computed(() => ({
  fragments: totalFragments,
  fibers: totalFibers,
  foams: totalFoams,
  films: totalFilms,
  pellets: totalPellets
}))

const totalMP = computed(() => Object.values(microplasticData.value).reduce((a, b) => a + b, 0))

const percentages = computed(() => {
  const t = totalMP.value
  if (t === 0) return { fragments: 0, fibers: 0, foams: 0, films: 0, pellets: 0 }
  return {
    fragments: Math.round((microplasticData.value.fragments / t) * 100),
    fibers: Math.round((microplasticData.value.fibers / t) * 100),
    foams: Math.round((microplasticData.value.foams / t) * 100),
    films: Math.round((microplasticData.value.films / t) * 100),
    pellets: Math.round((microplasticData.value.pellets / t) * 100)
  }
})

const mpColors = {
  fragments: '#0B2E4E',
  fibers: '#19568E',
  films: '#63B3FF',
  foams: '#4688C7',
  pellets: '#B9DDFF'
}

const labelsMap = {
  fragments: 'Fragments',
  fibers: 'Fibers',
  foams: 'Foam',
  films: 'Films',
  pellets: 'Pellets'
}

const selectedKey = ref(null)

const donutLabelsMap = {
  fragments: 'Fragments',
  fibers: 'Fibers',
  foams: 'Foam',
  films: 'Films',
  pellets: 'Pellets'
}

const donutColors = {
  fragments: mpColors.fragments,
  fibers: mpColors.fibers,
  foams: mpColors.foams,
  films: mpColors.films,
  pellets: mpColors.pellets
}

// Series shown in the donut (updates when user filters via legend)
const displaySeries = ref([
  microplasticData.value.fragments,
  microplasticData.value.fibers,
  microplasticData.value.foams,
  microplasticData.value.films,
  microplasticData.value.pellets
])

watch(microplasticData, (nv) => {
  if (selectedKey.value === null) {
    displaySeries.value = [nv.fragments, nv.fibers, nv.foams, nv.films, nv.pellets]
  } else {
    // keep filtered series consistent with the currently selected key
    displaySeries.value = [nv[selectedKey.value]]
  }
})

const compositionOptions = ref({
  chart: { type: 'donut', height: 260 },
  labels: Object.values(labelsMap),
  colors: Object.values(mpColors),
  legend: { show: false },
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, fontSize: '16px' },
          value: { show: true, fontSize: '24px', fontWeight: '600' },
          total: {
            show: true,
            label: 'Total number of MP found',
            fontSize: '14px',
            formatter: function (w) {
              const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0)
              if (total >= 1_000_000) return (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
              if (total >= 1_000) return (total / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
              return total
            }
          }
        }
      }
    }
  }
})

const handleLegendClick = (key) => {
  if (selectedKey.value === key) {
    selectedKey.value = null
    displaySeries.value = [
      microplasticData.value.fragments,
      microplasticData.value.fibers,
      microplasticData.value.foams,
      microplasticData.value.films,
      microplasticData.value.pellets
    ]
    compositionOptions.value.labels = Object.values(labelsMap)
    compositionOptions.value.colors = Object.values(mpColors)
    return
  }

  selectedKey.value = key
  displaySeries.value = [microplasticData.value[key]]
  compositionOptions.value.labels = [labelsMap[key]]
  compositionOptions.value.colors = [mpColors[key]]
}

// Bar: microplastic counts by site (stacked)
const siteNames = sites.map(s => s.site_name)
const fragmentsBySite = sites.map(s => s.fragment_count || 0)
const fibersBySite = sites.map(s => s.fiber_count || 0)
const filmsBySite = sites.map(s => s.film_count || 0)
const foamsBySite = sites.map(s => s.foam_count || 0)
const pelletsBySite = sites.map(s => s.beads_count || 0)

const bySiteSeries = ref([
  { name: 'Fragments', data: fragmentsBySite },
  { name: 'Fibers', data: fibersBySite },
  { name: 'Foam', data: foamsBySite },
  { name: 'Films', data: filmsBySite },
  { name: 'Pellets', data: pelletsBySite },
])
const bySiteOptions = ref({
  chart: { type: 'bar', stacked: true },
  xaxis: { categories: siteNames },
  legend: { position: 'top' },
})

// Column: microplastic counts by input type (aggregate mock categories)
// Use plastic_activity frequency as proxy
const inputTypes = ['Plastic mulching', 'Fertilizer sacks', 'Greenhouse plastic sheets/tunnels', 'Seedling trays (plastic)', 'Compost with visible plastics']
const inputCounts = inputTypes.map(type => sites.reduce((acc, s) => acc + (s.plastic_activity?.includes(type) ? 1 : 0), 0))

const inputSeries = ref([{ name: 'Sites with input', data: inputCounts }])
const inputOptions = ref({ chart: { type: 'bar' }, xaxis: { categories: inputTypes }, plotOptions: { bar: { horizontal: false } } })

// Small helper list for sample farms (name + contamination level based on total counts)
function contaminationLevel(site) {
  const total = (site.fragment_count || 0) + (site.fiber_count || 0) + (site.film_count || 0) + (site.foam_count || 0) + (site.beads_count || 0)
  if (total > 700) return 'HIGH'
  if (total > 400) return 'MODERATE'
  if (total > 150) return 'LOW'
  return 'ZERO'
}

const sampledSites = sites.map(s => ({ id: s.id, site_name: s.site_name, address: s.address, level: contaminationLevel(s) }))

const numOrganic = computed(() => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes('organic')).length)
const numConventional = computed(() => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes('conventional')).length)
const numIntegrated = computed(() => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes('integrated')).length)

// Contamination by farm practice (sum counts per practice) - include all 5 categories

// Build series grouped BY practice (series = practices), with categories as the x-axis
const categoriesForPracticeChart = ['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']

// Use display names that match PreviewCard (so legend text matches)
const practiceKeys = ['conventional', 'fully organic', 'integrated']
const practiceNames = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']

const fragmentsByPractice = practiceKeys.map(k => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (b.fragment_count || 0), 0))
const fibersByPractice = practiceKeys.map(k => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (b.fiber_count || 0), 0))
const filmsByPractice = practiceKeys.map(k => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (b.film_count || 0), 0))
const foamsByPractice = practiceKeys.map(k => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (b.foam_count || 0), 0))
const pelletsByPractice = practiceKeys.map(k => sites.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (b.beads_count || 0), 0))

const contaminationByPracticeSeries = ref(practiceNames.map((name, idx) => ({
  name,
  data: [
    fragmentsByPractice[idx] || 0,
    fibersByPractice[idx] || 0,
    foamsByPractice[idx] || 0,
    filmsByPractice[idx] || 0,
    pelletsByPractice[idx] || 0
  ]
})))

// compute a comfortable y-axis max from the data (per-category values across practices)
const allVals = contaminationByPracticeSeries.value.flatMap(s => s.data)
const maxVal = allVals.length ? Math.max(...allVals) : 700

// Use the same base options as PreviewCard so visuals match exactly
const contaminationByPracticeOptions = ref(getDefaultBarOptions(categoriesForPracticeChart, {
  chart: { type: 'bar' },
  plotOptions: { bar: { horizontal: false } },
  legend: { position: 'bottom' },
  yaxis: { title: { text: 'Number of MP found (in Thousands)' }, min: 0, max: Math.ceil(maxVal * 1.15) }
}))

// Monthly trend (mock): distribute totals across months proportionally (simple smoothing)
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function distributeAcrossMonths(value) {
  // simple triangular weighting to create a seasonality-like shape
  const weights = [0.6, 0.7, 0.9, 1, 1.1, 1.2, 1.2, 1.1, 1, 0.9, 0.8, 0.7]
  const totalW = weights.reduce((a, b) => a + b, 0)
  return weights.map(w => Math.round(value * w / totalW))
}

const monthlySeries = ref([
  { name: 'Fragments', data: distributeAcrossMonths(totalFragments) },
  { name: 'Fibers', data: distributeAcrossMonths(totalFibers) },
])
const monthlyOptions = ref({ chart: { type: 'line', zoom: { enabled: false } }, xaxis: { categories: months }, stroke: { curve: 'smooth' } })

// Microplastic count by soil texture (aggregate)
const textures = Array.from(new Set(sites.map(s => s.soil_type || 'Unknown')))
const byTextureSeries = ref([
  { name: 'Fragments', data: textures.map(t => sites.filter(s => (s.soil_type || '') === t).reduce((a, b) => a + (b.fragment_count || 0), 0)) },
  { name: 'Fibers', data: textures.map(t => sites.filter(s => (s.soil_type || '') === t).reduce((a, b) => a + (b.fiber_count || 0), 0)) },
])
const byTextureOptions = ref({ chart: { type: 'bar' }, xaxis: { categories: textures }, plotOptions: { bar: { horizontal: false } } })

// Color counts & size ranges are not in dummy data; create simple derived mock distributions based on total counts
const colors = ['Gray', 'Blue', 'White', 'Transparent']
const colorSeries = ref([
  { name: 'Fragments', data: [Math.round(totalFragments * 0.35), Math.round(totalFragments * 0.3), Math.round(totalFragments * 0.2), Math.round(totalFragments * 0.15)] },
  { name: 'Fibers', data: [Math.round(totalFibers * 0.4), Math.round(totalFibers * 0.25), Math.round(totalFibers * 0.25), Math.round(totalFibers * 0.1)] },
])
const colorOptions = ref({ chart: { type: 'bar' }, xaxis: { categories: colors }, plotOptions: { bar: { horizontal: false } }, legend: { position: 'top' } })

const sizeRanges = ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm']
const sizeSeries = ref([
  { name: 'Fragments', data: [20, 40, 60, 30, 15].map(v => Math.round(v * (totalFragments / 200))) },
  { name: 'Fibers', data: [15, 30, 50, 20, 10].map(v => Math.round(v * (totalFibers / 150))) },
])
const sizeOptions = ref({ chart: { type: 'bar', stacked: true }, xaxis: { categories: sizeRanges }, plotOptions: { bar: { horizontal: false } } })

const aiSummaryText = 'Based on the data, farms practicing organic cultivation tend to have lower microplastic contamination levels compared to conventional farms. Implementing integrated pest management and reducing plastic mulch usage could further mitigate contamination risks.';

// Map setup
const mapRef = ref(null)

function colorForLevel(level) {
  switch (level) {
    case 'HIGH': {
      return '#d32f2f'
    }
    case 'MODERATE': {
      return '#fb8c00'
    }
    case 'LOW': {
      return '#43a047'
    }
    default: {
      return '#9e9e9e'
    }
  }
}

const printReport = () => {
  window.print()
}

onMounted(() => {
  if (!mapRef.value || typeof window === 'undefined') return
  const map = L.map(mapRef.value, { scrollWheelZoom: false }).setView([14.03, 121.58], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map)

  const markers = []
  for (const site of sites) {
    if (!site.latitude || !site.longitude) continue
    const lvl = contaminationLevel(site)
    const color = colorForLevel(lvl)
    const marker = L.circleMarker([site.latitude, site.longitude], {
      radius: 9,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      fillOpacity: 0.95,
    }).bindPopup(`<strong>${site.site_name}</strong><br/>${site.address}<br/>Level: ${lvl}`)
    marker.addTo(map)
    markers.push([site.latitude, site.longitude])
  }
  if (markers.length > 0) {
    map.fitBounds(markers, { padding: [40, 40] })
  }
})

// Most common crops
const cropCounts = {}
for (const s of sites) {
  for (const c of (s.crops || [])) {
    const key = (c || '').trim()
    if (!key) continue
    cropCounts[key] = (cropCounts[key] || 0) + 1
  }
}
const sortedCrops = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])
const topCrops = sortedCrops.slice(0, 10).map(([crop, count]) => ({ crop, count }))

// Farm size distribution: small <1ha, medium 1-3ha, large >3ha
const farmSizeCounts = {
  small: sites.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha < 1).length,
  medium: sites.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
  large: sites.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha > 3).length,
}
const farmSizeSeries = ref([{ name: 'Farms', data: [farmSizeCounts.small, farmSizeCounts.medium, farmSizeCounts.large] }])
const farmSizeOptions = ref({ chart: { type: 'bar' }, xaxis: { categories: ['Small (<1ha)', 'Medium (1-3ha)', 'Large (>3ha)'] }, plotOptions: { bar: { horizontal: false, columnWidth: '60%' } }, legend: { show: false } })

</script>

<template>
  <div class="insight-page">
    <header class="page-header">
      <div class="d-flex align-center">
        <VIcon style="cursor:pointer; vertical-align:middle;" @click="$router.back()" color="grey" size="x-large">
          mdi-menu-left</VIcon>
        <h1>Tayabas
          City, Quezon Province, Philippines</h1>
      </div>
    </header>

    <div class="columns">
      <div class="kpi">
        <div class="kpi-num">{{ sites.length }}</div>
        <div class="v-separator"></div>
        <div class="kpi-body">Number of Sampled Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numOrganic }}</div>
        <div class="v-separator"></div>
        <div class="kpi-body">Organic Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numConventional }}</div>
        <div class="v-separator"></div>
        <div class="kpi-body">Conventional Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numIntegrated }}</div>
        <div class="v-separator"></div>
        <div class="kpi-body">Integrated Farms</div>
      </div>
      <div class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
        style=" box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
        <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
        <p class="text-h4 text-white font-weight-bold">Print Report</p>
      </div>
    </div>
    <VRow class="mt-2">
      <VCol cols="4" class="d-flex flex-column justify-space-between">
        <div class="card crops-card" style="height: 38%;">
          <h3>Most Common Crops Grown</h3>
          <ul class="crop-list">
            <li v-for="(c, idx) in topCrops" :key="c.crop">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="crop-name">{{ c.crop }}</span>
              </div>
            </li>
          </ul>
        </div>
        <div class="card" style="height: 58%;">
          <h3>Size Distribution of Sampled Farms</h3>
          <apexchart height="170" :options="farmSizeOptions" :series="farmSizeSeries" type="bar" />
          <div style="display:flex; justify-content:space-around; margin-top:8px; font-size:13px;">
            <div><strong>{{ farmSizeSeries[0].data[0] }}</strong>
              <div style="opacity:.7">Small &lt;1ha</div>
            </div>
            <div><strong>{{ farmSizeSeries[0].data[1] }}</strong>
              <div style="opacity:.7">Medium 1–3ha</div>
            </div>
            <div><strong>{{ farmSizeSeries[0].data[2] }}</strong>
              <div style="opacity:.7">Large &gt;3ha</div>
            </div>
          </div>
        </div>
      </VCol>

      <VCol cols="4">
        <div class="card">

          <MPDonutChart :microplasticData="microplasticData" :labelsMap="donutLabelsMap" :colors="donutColors"
            :activeKey="selectedKey" @selection="handleLegendClick" />

        </div>
      </VCol>

      <VCol cols="4">
        <div class="card">
          <h3>Counts by Site (stacked)</h3>
          <apexchart height="300" :options="bySiteOptions" :series="bySiteSeries" type="bar" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="6">
        <div class="card">
          <MPPracticeBar :series="contaminationByPracticeSeries" :options="contaminationByPracticeOptions"
            title="Contamination Comparison by Farm Practices" subtitle="Data as of September 22, 2025" height="260" />
        </div>
      </VCol>
      <VCol cols="6">
        <div class="card">
          <h3>Average Monthly Microplastic Waste</h3>
          <apexchart height="260" :options="monthlyOptions" :series="monthlySeries" type="line" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="7">
        <div class="card">
          <h3>Plastic-related Inputs (site counts)</h3>
          <apexchart height="240" :options="inputOptions" :series="inputSeries" type="bar" />
        </div>
      </VCol>
      <VCol cols="5">
        <div class="card">
          <h3>Microplastic Count by Soil Texture</h3>
          <apexchart height="260" :options="byTextureOptions" :series="byTextureSeries" type="bar" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="6" class="d-flex flex-column justify-space-between">
        <div class="card bottom-card">
          <h3>Microplastic Count by Color</h3>
          <apexchart height="220" :options="colorOptions" :series="colorSeries" type="bar" />
        </div>

        <div class="card bottom-card">
          <h3>Microplastic Count by Size Range</h3>
          <apexchart height="260" :options="sizeOptions" :series="sizeSeries" type="bar" />
        </div>

        <div class="card bottom-card">
          <div class="d-flex align-center">
            <h3>AI Insights</h3>
            <VIcon color="blue" class="ml-2">mdi-creation</VIcon>
          </div>
          <p class="subtitle mb-2">Generated on September 22, 2025</p>
          <div class="summary-box">
            <p>{{ aiSummaryText }}</p>
          </div>
        </div>
      </VCol>

      <VCol cols="6">
        <div class="card list-card map-card">
          <h3>Sampled Farms</h3>
          <ul>
            <li v-for="s in sampledSites" :key="s.id">
              <div class="farm-name">{{ s.site_name }}</div>
              <div class="farm-addr">{{ s.address }}</div>
              <div class="farm-level" :data-level="s.level">{{ s.level }}</div>
            </li>
          </ul>
          <div id="map" ref="mapRef" style="height:320px; border-radius:8px; overflow:hidden;" />
        </div>
      </VCol>
    </VRow>
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
  margin-bottom: 12px
}

.page-header {
  color: var(--v-theme-on-surface);
  opacity: 0.8
}

.subtitle {
  color: rgb(155, 155, 155)
}

.kpis {
  display: flex;
  gap: 12px
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


.columns {
  /* Make this 5-column layout using repeat */
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  flex-wrap: wrap;
}

.main-col {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px
}

.side-col {
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px
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

/* Add margin-top to every .bottom-card except the first */
.bottom-card:not(:first-of-type) {
  margin-top: 1.3em;
  /* adjust as needed */
}


.list-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 340px;
  overflow: auto
}

.list-card li {
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, .06);
  display: flex;
  flex-direction: column;
}

.farm-name {
  font-weight: 600
}

.farm-addr {
  color: rgba(0, 0, 0, .6);
  font-size: 13px
}

.map-card {
  padding: 20px;
}

.map-card #map {
  width: 100%;
  height: 320px;
}

.crops-card {
  padding: 20px;
}

.crop-list {
  margin: 0;
  /* padding-left: 0; */
  columns: 2;
  column-gap: 18px;
  /* list-style-position: inside */
  list-style: none;
}

.crop-list li {
  color: rgba(0, 0, 0, 0.85);
  break-inside: avoid-column;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1976d2;
  padding: 12px 16px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .crop-list {
    columns: 1
  }
}

.farm-level[data-level='HIGH'] {
  color: #b71c1c;
  font-weight: 700
}

.farm-level[data-level='MODERATE'] {
  color: #ff9800;
  font-weight: 700
}

.farm-level[data-level='LOW'] {
  color: #4caf50;
  font-weight: 700
}

.farm-level[data-level='ZERO'] {
  color: #9e9e9e;
  font-weight: 700
}

@media (max-width: 1100px) {
  .main-col {
    grid-template-columns: 1fr
  }

  .side-col {
    width: 320px
  }
}

@media (max-width: 900px) {
  .columns {
    flex-direction: column
  }

  .side-col {
    width: 100%
  }

  .main-col {
    grid-template-columns: 1fr
  }
}
</style>

/* Styles reused from PreviewCard.vue to keep the Microplastic Composition card visually consistent */
<style scoped>
.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 1em;
  padding: 0.7em 1em;
  border-radius: 0.5em;
  color: white;
  cursor: pointer;
  transition: opacity 0.3s;
}

.legend-item p {
  margin: 0;
  font-size: 1em;
}

.separator {
  width: 2px;
  height: 2.5em;
  background-color: #ffffff;
  margin: 0 1em;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1976d2;
  padding: 12px 16px;
  margin-top: 8px;
}
</style>
