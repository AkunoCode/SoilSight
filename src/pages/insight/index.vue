<script setup>
import { onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { useRouter } from 'vue-router'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { useInsightData } from '@/composables/useInsightData.js'
import { useInsightKPIs } from '@/composables/useInsightKPIs.js'
import { useInsightCharts } from '@/composables/useInsightCharts.js'
import { MP_COLOR_MAP } from '@/config/chartPalette.js'

const router = useRouter()
const app    = useAppStore()
const { displayLatestSampleDate, fetchLatestSampleDate } = useLatestSampleDate()

const {
  sites, loading, error,
  colorData, colorLoading,
  sizeData, selectedSizeField,
  loadAll, fetchSizeData,
} = useInsightData()

const {
  microplasticTotals,
  avgContaminationDensity,
  dominantPollutant,
  highestRiskSite,
} = useInsightKPIs(sites, colorData)

const {
  siteCategories, siteTotals, siteDrilldown,
  inputTotals, inputDrilldown,
  textures, textureTotals, textureDrilldown,
  contaminationByPracticeSeries, contaminationByPracticeOptions,
  biologicalRiskData,
  farmSizeSeries, farmSizeOptions,
  topCrops,
} = useInsightCharts(sites, sizeData)

const mpColors       = { ...MP_COLOR_MAP }
const donutColors    = { ...MP_COLOR_MAP }
const donutLabelsMap = { fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets' }

// microplasticData shape expected by MPDonutChart
const microplasticData = microplasticTotals

// Aliases — template uses these original variable names; renaming would require template changes
const colorComparisonLoading = colorLoading
const colorComparisonAll     = colorData
const sizeComparisonAll      = sizeData

function handleLegendClick(key) { app.toggleSelectedMorphology(key) }
function printReport() { window.print() }

watch(selectedSizeField, newVal => fetchSizeData(newVal))

onMounted(async () => {
  try {
    app.startLoading()
    await loadAll()
    try { await fetchLatestSampleDate() } catch { /* non-critical */ }
  } finally {
    try { app.finishLoading() } catch { /* ignore */ }
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
      <!-- [Number] Farms-->
      <KPI title="Number of Sites Sampled" :value="`${sites.length} Farms`" subtitle="Within Tayabas, Quezon" />
      <!-- [Number] MP/kg -->
      <KPI title="Avg. Contamination Density" :value="`${avgContaminationDensity} MP/kg`"
        subtitle="Averaged across all sites" />
      <!-- Highest shape and its most common color -->
      <KPI title="Dominant Pollutant" :value="dominantPollutant" subtitle="Among 5 shapes detected" />
      <!-- subtitle should be the density of the highest risk site -->
      <KPI title="Highest Risk Site" :value="`${highestRiskSite.name} Farm`"
        :subtitle="`${highestRiskSite.density} MP`" />
      <div class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
        style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
        <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
        <p class="text-h4 text-white font-weight-bold">Print Report</p>
      </div>
    </div>
    <VRow class="mt-2">
      <VCol cols="6">
        <div class="card">
          <AISummary />
        </div>
      </VCol>
      <VCol cols="6">
        <div class="card list-card map-card">
          <h3 class="mb-2">Contamination Density by Farm Practice</h3>
          <SampledFarms :sampled-sites="sites" />
        </div>
      </VCol>
    </VRow>
    <VRow class="mt-2">
      <VCol cols="4">
        <div class="card">
          <MPPracticeBar :height="400" :options="contaminationByPracticeOptions" :series="contaminationByPracticeSeries"
            :subtitle="`Data as of ${displayLatestSampleDate}`" title="Contamination Comparison by Farm Practices"
            :filter-key="app.selectedMorphology" />
        </div>
      </VCol>
      <VCol cols="4">
        <!-- Source Identification Heatmap -->
        <div class="card">
          <h3>Source Identification Heatmap</h3>
          <p class="subtitle mb-2">Microplastic Counts by Source and Plastic Type</p>
          <SourceIdentificationHeatmap :sites="sites" height="400" />
        </div>
      </VCol>
      <VCol cols="4">
        <!-- Source Degradation Index Gauge Chart -->
        <div class="card">
          <SourceDegradationIndex :sites="sites" height="400" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="5">
        <div class="card">
          <MPDonutChart :height="360" :active-key="app.selectedMorphology" :colors="donutColors"
            :labels-map="donutLabelsMap" :microplastic-data="microplasticData" @selection="handleLegendClick"
            :subtitle="`Data as of ${displayLatestSampleDate}`" />
        </div>
      </VCol>

      <VCol cols="7">
        <div class="card">
          <BiologicalRiskChart :height="360" :data="biologicalRiskData"
            :loading="!sizeComparisonAll || !sizeComparisonAll.categories?.length"
            :subtitle="`Data as of ${displayLatestSampleDate}`" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="6">
        <div class="card">
          <SoilTrapEfficiencyBoxplot :sites="sites" height="360" />
        </div>
      </VCol>
      <VCol cols="6">
        <div class="card">
          <template v-if="colorComparisonLoading">
            <div :style="{ minHeight: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center' }">
              <VProgressCircular color="primary" indeterminate size="28" />
            </div>
          </template>
          <template v-else-if="colorComparisonAll && colorComparisonAll.totals && colorComparisonAll.totals.length > 0">
            <SiteDrilldownChart :categories="colorComparisonAll.categories"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']" :colors="mpColors"
              :drilldown="colorComparisonAll.drilldown" :height="360" title="Microplastic Count by Color"
              :totals="colorComparisonAll.totals" :filter-key="app.selectedMorphology" />
          </template>
          <template v-else>
            <div style="padding: 20px; text-align:center; color: #666;">
              <p style="margin:0; font-weight:600">Microplastic Count by Color</p>
              <p style="margin:8px 0 0;">No color aggregation data available yet.</p>
            </div>
          </template>
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="12">
        <MonthlyTrendChart :height="340" :colors="mpColors" :microplastic-data="microplasticData"
          :subtitle="`Data as of ${displayLatestSampleDate}`" :filter-key="app.selectedMorphology" />
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
  border-left: 4px solid #366ECE;
  padding: 12px 16px;
  margin-top: 8px;
}

.report-preview {
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  line-clamp: 7;
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