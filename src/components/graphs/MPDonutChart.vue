<script setup>
  import { computed } from 'vue'
  import { MP_COLOR_MAP } from '@/config/chartPalette.js'
  import ApexChartBase from './ApexChartBase.vue'

  const props = defineProps({
    microplasticData: { type: Object, required: true },
    activeKey: { type: String, default: null },
    title: { type: String, default: 'Total Microplastic Waste per Morphological Category' },
    subtitle: { type: String, default: '' },
    // CHANGE: Default height to '100%' to fill container
    height: { type: [Number, String], default: '100%' },

    labelsMap: {
      type: Object,
      default: () => ({
        fragments: 'Fragments', fibers: 'Fibers', foams: 'Foam', films: 'Films', sheets: 'Sheets',
      }),
    },
    colors: {
      type: Object,
      default: () => ({ ...MP_COLOR_MAP }),
    },
  })

  const emit = defineEmits(['selection'])
  const ORDERED_KEYS = ['fragments', 'fibers', 'foams', 'films', 'sheets']

  // --- Data Logic ---
  const rawValues = computed(() => ORDERED_KEYS.map(k => props.microplasticData[k] || 0))
  const total = computed(() => rawValues.value.reduce((a, b) => a + b, 0))
  const hasData = computed(() => total.value > 0)

  const percentages = computed(() => {
    const res = {}
    for (const k of ORDERED_KEYS) {
      const val = props.microplasticData[k] || 0
      res[k] = total.value ? Math.round((val / total.value) * 100) : 0
    }
    return res
  })

  // --- Chart Logic ---
  const chartSeries = computed(() => {
    if (props.activeKey) {
      return [props.microplasticData[props.activeKey] || 0]
    }
    return rawValues.value
  })

  const chartOptions = computed(() => {
    const currentKeys = props.activeKey ? [props.activeKey] : ORDERED_KEYS

    return {
      chart: {
        type: 'donut',
        // CHANGE: Use prop height (likely '100%')
        height: props.height,
        fontFamily: 'inherit',
        toolbar: { show: false },
        // CHANGE: Remove strict parentHeightOffset to allow better flex filling
        parentHeightOffset: 0,
        events: {
          dataPointSelection: (e, chart, config) => {
            if (props.activeKey) {
              emit('selection', null)
            } else {
              const key = ORDERED_KEYS[config.dataPointIndex]
              emit('selection', key)
            }
          },
        },
      },
      labels: currentKeys.map(k => props.labelsMap[k]),
      colors: currentKeys.map(k => props.colors[k] || '#ccc'),
      dataLabels: { enabled: false },
      legend: { show: false },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              name: { show: true, fontSize: '14px', color: '#6b7280' },
              value: { show: true, fontSize: '24px', fontWeight: 700 },
              total: {
                show: true,
                showAlways: true,
                label: props.activeKey ? props.labelsMap[props.activeKey] : 'Total MP',
                formatter: () => {
                  const val = props.activeKey
                    ? (props.microplasticData[props.activeKey] || 0)
                    : total.value

                  if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M'
                  if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K'
                  return val.toLocaleString()
                },
              },
            },
          },
        },
      },
      stroke: { show: false },
    }
  })

  function handleLegendClick (key) {
    emit('selection', props.activeKey === key ? null : key)
  }
</script>

<template>
  <div class="donut-card">
    <div class="header">
      <h4 class="title">{{ title }}</h4>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="!hasData" class="no-data">
      <span>No data available</span>
    </div>

    <div v-else class="content-row">
      <div class="chart-col">
        <ApexChartBase :height="height" :options="chartOptions" :series="chartSeries" type="donut" />
      </div>

      <div class="legend-col">
        <div
          v-for="key in ORDERED_KEYS"
          :key="key"
          class="legend-item"
          :class="{ 'inactive': activeKey && activeKey !== key }"
          :style="{ backgroundColor: colors[key] }"
          @click="handleLegendClick(key)"
        >
          <div class="percent">{{ percentages[key] }}%</div>
          <div class="divider" />
          <div class="info">
            <span class="label">{{ labelsMap[key] }}</span>
            <span class="count">{{ (microplasticData[key] || 0).toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.donut-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  /* Ensure root takes full height */
}

.header {
  margin-bottom: 16px;
  flex-shrink: 0;
  /* Don't shrink header */
}

.title {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 0.875rem;
  color: #9ca3af;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  /* Fill remaining space */
  color: #9ca3af;
  font-style: italic;
}

.content-row {
  display: flex;
  gap: 16px;
  align-items: stretch;
  /* Stretch items to match height */
  flex: 1;
  /* Crucial: Fill all remaining vertical space */
  min-height: 0;
  /* Prevent flex overflow bug */
}

.chart-col {
  flex: 7;
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* Center chart vertically */
  /* Ensure inner chart container takes full size */
  min-width: 0;
}

.legend-col {
  flex: 5;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  /* Allow scrolling if chart gets too big */
  padding-right: 4px;
  /* Space for scrollbar */
}

.legend-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
  /* Prevent legend items from squishing */
}

.legend-item:hover {
  filter: brightness(110%);
}

.legend-item.inactive {
  opacity: 0.3;
}

.percent {
  font-size: 1.5rem;
  font-weight: 700;
  min-width: 60px;
}

.divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.4);
  margin: 0 16px;
}

.info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.label {
  font-size: 0.875rem;
  opacity: 0.9;
}

.count {
  font-size: 1.1rem;
  font-weight: 700;
}
</style>
