<script setup>
  import { computed, ref, watch } from 'vue'
  import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
  import { safeColorArray, updateApexChart } from '@/composables/useApexChart'
  import ApexChartBase from './ApexChartBase.vue'

  const props = defineProps({
    microplasticData: { type: Object, required: true },
    labelsMap: { type: Object, default: () => ({ fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets', pellets: 'Pellets' }) },
    colors: { type: Object, default: () => ({ fibers: '#19568E', fragments: '#0B2E4E', films: '#63B3FF', foams: '#4688C7', sheets: '#8AB4FF', pellets: '#B9DDFF' }) },
    activeKey: { type: [String, null], default: null },
    date: { type: String, default: '' },
  })

  const emit = defineEmits(['selection'])

  // Series and derived values
  const chartSeries = computed(() => [
    props.microplasticData.fragments || 0,
    props.microplasticData.fibers || 0,
    props.microplasticData.foams || 0,
    props.microplasticData.films || 0,
    props.microplasticData.sheets || 0,
    props.microplasticData.pellets || 0,
  ])

  const total = computed(() => chartSeries.value.reduce((a, b) => a + b, 0))

  const percentages = computed(() => {
    const t = total.value
    if (t === 0) return { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0, pellets: 0 }
    return {
      fragments: Math.round(((props.microplasticData.fragments || 0) / t) * 100),
      fibers: Math.round(((props.microplasticData.fibers || 0) / t) * 100),
      foams: Math.round(((props.microplasticData.foams || 0) / t) * 100),
      films: Math.round(((props.microplasticData.films || 0) / t) * 100),
      sheets: Math.round(((props.microplasticData.sheets || 0) / t) * 100),
      pellets: Math.round(((props.microplasticData.pellets || 0) / t) * 100),
    }
  })

  // State and chart refs
  const selectedKey = ref(null)
  const donutChart = ref(null)
  const displaySeries = ref([...chartSeries.value])

  watch(chartSeries, newSeries => {
    if (selectedKey.value === null) displaySeries.value = newSeries
  }, { immediate: true })

  const donutChartOptions = ref({
    chart: {
      type: 'donut', height: 350, toolbar: { show: false },
      events: {
        dataPointSelection (_, __, config) {
          const indexToKey = ['fragments', 'fibers', 'foams', 'films', 'sheets', 'pellets']
          const clickedKey = indexToKey[config.dataPointIndex]
          if (selectedKey.value === null) handleLegendClick(clickedKey)
        },
      },
    },
    labels: Object.values(props.labelsMap),
    colors: safeColorArray(props.colors),
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
            total: { show: true, label: 'Total number\nof MP found', fontSize: '14px', formatter: defaultTotalFormatter },
          },
        },
      },
    },
  })

  const { displayLatestSampleDate } = useLatestSampleDate()
  const defaultDate = displayLatestSampleDate

  function defaultTotalFormatter (w) {
    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0)
    if (total >= 1_000_000) return (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (total >= 1000) return (total / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return total
  }

  function clearSelections () {
    selectedKey.value = null
    displaySeries.value = [...chartSeries.value]

    // reset options and try to update the chart instance
    donutChartOptions.value = {
      ...donutChartOptions.value,
      labels: Object.values(props.labelsMap),
      colors: safeColorArray(props.colors),
      chart: { ...donutChartOptions.value.chart },
    }
    // try updating chart via composable (safe)
    setTimeout(() => {
      try {
        const inner = donutChart.value?.chartRef
        if (donutChart.value && typeof donutChart.value.clearSelections === 'function') donutChart.value.clearSelections()
        void updateApexChart(inner, { labels: donutChartOptions.value.labels, colors: donutChartOptions.value.colors }, displaySeries.value, true)
      } catch {
        // silent
      }
    }, 50)

    emit('selection', null)
  }

  function applySelection (key, emitEvent = true) {
    if (!key || selectedKey.value === key) {
      clearSelections()
      return
    }

    selectedKey.value = key
    displaySeries.value = [props.microplasticData[key] || 0]

    donutChartOptions.value = {
      ...donutChartOptions.value,
      labels: [props.labelsMap[key]],
      colors: safeColorArray([props.colors[key]]),
      chart: { ...donutChartOptions.value.chart },
    }
    setTimeout(() => {
      try {
        const inner = donutChart.value?.chartRef
        void updateApexChart(inner, { labels: donutChartOptions.value.labels, colors: donutChartOptions.value.colors }, displaySeries.value, true)
      } catch {
        // silent
      }
    }, 50)

    if (emitEvent) emit('selection', key)
  }

  const handleLegendClick = key => applySelection(key, true)

  watch(() => props.activeKey, newKey => {
    if (newKey === selectedKey.value) return
    applySelection(newKey, false)
  })
</script>

<template>
  <VRow>
    <VCol cols="7">
      <div class="d-flex flex-column">
        <div class="d-flex flex-column">
          <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">Total Microplastic Waste
            per Morphological
            Category
          </h4>
          <p class="subtitle mb-2">{{ props.date || defaultDate }}</p>
        </div>
        <ApexChartBase
          ref="donutChart"
          :height="300"
          :options="donutChartOptions"
          :series="displaySeries"
          type="donut"
        />
      </div>
    </VCol>

    <!-- Custom Legend -->
    <VCol cols="5">
      <div class="d-flex flex-column">
        <template v-for="(value, key) in microplasticData" :key="key">
          <div
            class="legend-item"
            :style="{
              backgroundColor: colors[key],
              opacity: selectedKey === null || selectedKey === key ? 1 : 0.4
            }"
            @click="handleLegendClick(key)"
          >
            <p class="font-weight-bold" style="font-size: 1.5em;">
              {{ percentages[key] }}%
            </p>
            <div class="separator" />
            <div class="d-flex flex-column" style="line-height: 1.2em;">
              <p>{{ key.charAt(0).toUpperCase() + key.slice(1) }}</p>
              <p class="font-weight-bold" style="font-size: 1.2em;">
                {{ value.toLocaleString() }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </VCol>
  </VRow>
</template>

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

.subtitle {
    color: rgb(155, 155, 155);
}
</style>
