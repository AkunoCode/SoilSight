<script setup>
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { safeColorArray, updateApexChart } from '@/composables/useApexChart'
import ApexChartBase from './ApexChartBase.vue'

const props = defineProps({
  microplasticData: { type: Object, required: true },
  // Define standard keys to ensure chart and legend order always match
  labelsMap: {
    type: Object,
    default: () => ({
      fragments: 'Fragments',
      fibers: 'Fibers',
      foams: 'Foam',
      films: 'Films',
      sheets: 'Sheets'
    })
  },
  colors: {
    type: Object,
    default: () => ({
      fibers: '#19568E',
      fragments: '#0B2E4E',
      films: '#63B3FF',
      foams: '#4688C7',
      sheets: '#8AB4FF'
    })
  },
  activeKey: { type: [String, null], default: null },
  date: { type: String, default: '' },
})

const emit = defineEmits(['selection'])
const app = useAppStore()
const { displayLatestSampleDate } = useLatestSampleDate()

// Constants
const ORDERED_KEYS = ['fragments', 'fibers', 'foams', 'films', 'sheets']
const defaultDate = displayLatestSampleDate

// Refs
const donutChart = ref(null)
const selectedKey = ref(null)

// --- Computed Data ---

const chartSeries = computed(() => {
  return ORDERED_KEYS.map(key => props.microplasticData[key] || 0)
})

const total = computed(() => chartSeries.value.reduce((a, b) => a + b, 0))

const hasData = computed(() => total.value > 0)

const percentages = computed(() => {
  if (!hasData.value) return {}
  const result = {}
  ORDERED_KEYS.forEach(key => {
    const val = props.microplasticData[key] || 0
    result[key] = Math.round((val / total.value) * 100)
  })
  return result
})

// Initialize display series
const displaySeries = ref([...chartSeries.value])

// --- Chart Configuration ---

function defaultTotalFormatter(w) {
  const t = w.globals.seriesTotals.reduce((a, b) => a + b, 0)
  if (t >= 1_000_000) return (t / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (t >= 1000) return (t / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return t
}

const donutChartOptions = ref({
  chart: {
    type: 'donut',
    height: 350,
    toolbar: { show: false },
    events: {
      dataPointSelection(_, __, config) {
        const clickedKey = ORDERED_KEYS[config.dataPointIndex]
        if (selectedKey.value === null) handleLegendClick(clickedKey)
      },
    },
  },
  labels: ORDERED_KEYS.map(k => props.labelsMap[k]),
  colors: safeColorArray(props.colors), // Assumes safeColorArray handles object->array conversion based on keys if needed, or passes array
  dataLabels: { enabled: false },
  legend: { show: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, fontSize: '16px' },
          value: { show: true, fontSize: '22px', fontWeight: 'bold' },
          total: {
            show: true,
            label: 'Total number\nof MP found',
            fontSize: '14px',
            formatter: defaultTotalFormatter
          },
        },
      },
    },
  },
})

// --- Interaction Logic ---

// Helper to safely update chart asynchronously
function triggerChartUpdate(newOptions, newSeries) {
  setTimeout(() => {
    try {
      const inner = donutChart.value?.chartRef
      if (inner) {
        updateApexChart(inner, newOptions, newSeries, true)
      }
    } catch (e) {
      // chart instance might not be ready
    }
  }, 50)
}

function clearSelections() {
  selectedKey.value = null
  displaySeries.value = [...chartSeries.value]

  // Reset options
  donutChartOptions.value = {
    ...donutChartOptions.value,
    labels: ORDERED_KEYS.map(k => props.labelsMap[k]),
    colors: safeColorArray(props.colors),
  }

  // Clear internal selection if method exists
  if (donutChart.value?.clearSelections) {
    donutChart.value.clearSelections()
  }

  triggerChartUpdate({
    labels: donutChartOptions.value.labels,
    colors: donutChartOptions.value.colors
  }, displaySeries.value)

  emit('selection', null)
  app.clearSelectedMorphology?.()
}

function applySelection(key, emitEvent = true) {
  if (!key || selectedKey.value === key) {
    clearSelections()
    return
  }

  selectedKey.value = key
  // Show only the selected value in the chart ring
  displaySeries.value = [props.microplasticData[key] || 0]

  // Update options to show single label/color
  donutChartOptions.value = {
    ...donutChartOptions.value,
    labels: [props.labelsMap[key]],
    colors: safeColorArray([props.colors[key]]),
  }

  triggerChartUpdate({
    labels: donutChartOptions.value.labels,
    colors: donutChartOptions.value.colors
  }, displaySeries.value)

  if (emitEvent) emit('selection', key)
  app.setSelectedMorphology?.(key)
}

const handleLegendClick = (key) => applySelection(key, true)

// --- Watchers ---

// Update series when props change (only if no active selection)
watch(chartSeries, (newSeries) => {
  if (selectedKey.value === null) {
    displaySeries.value = newSeries
  }
}, { immediate: true })

// Sync with activeKey prop
watch(() => props.activeKey, (newKey) => {
  if (newKey !== selectedKey.value) applySelection(newKey, false)
})

// Sync with Store
watch(() => app.selectedMorphology, (newKey) => {
  if (newKey !== selectedKey.value) applySelection(newKey, false)
})
</script>

<template>
  <div class="card-container">
    <div class="header-section">
      <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">
        Total Microplastic Waste per Morphological Category
      </h4>
      <p class="subtitle mb-2">{{ props.date || defaultDate }}</p>
    </div>

    <div v-if="!hasData" class="no-data-container">
      <span class="no-data-text">No data available</span>
    </div>

    <VRow v-else class="chart-row" no-gutters>
      <VCol cols="7">
        <ApexChartBase ref="donutChart" :height="300" :options="donutChartOptions" :series="displaySeries"
          type="donut" />
      </VCol>

      <VCol cols="5">
        <div class="d-flex flex-column">
          <template v-for="key in ORDERED_KEYS" :key="key">
            <div class="legend-item" :style="{
              backgroundColor: props.colors[key],
              opacity: selectedKey === null || selectedKey === key ? 1 : 0.4
            }" @click="handleLegendClick(key)">
              <p class="font-weight-bold" style="font-size: 1.5em;">
                {{ percentages[key] }}%
              </p>
              <div class="separator" />
              <div class="d-flex flex-column" style="line-height: 1.2em;">
                <p>{{ labelsMap[key] }}</p>
                <p class="font-weight-bold" style="font-size: 1.2em;">
                  {{ (microplasticData[key] || 0).toLocaleString() }}
                </p>
              </div>
            </div>
          </template>
        </div>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.card-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.no-data-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  flex: 1;
}

.no-data-text {
  color: rgb(155, 155, 155);
  font-style: italic;
  font-size: 1.1em;
}

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

.subtitle {
  color: rgb(155, 155, 155);
}
</style>