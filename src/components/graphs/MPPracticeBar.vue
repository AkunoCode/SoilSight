<script setup>
  import { computed } from 'vue'
  import ApexChartBase from './ApexChartBase.vue'

  const props = defineProps({
    series: { type: Array, required: true },
    options: { type: Object, required: true },
    filterKey: { type: String, default: null },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    date: { type: String, default: '' },
    height: { type: Number, default: 500 },
  })

  // Helper to match filterKey (e.g., "Fragments") to the correct index
  function getCategoryIndex (key, categories) {
    if (!key) return -1
    const k = key.toLowerCase()
    const normCats = categories.map(c => String(c).toLowerCase())

    // Try finding strict match or substring match
    let idx = normCats.findIndex(c => c.includes(k) || k.includes(c))

    // Fallback for common domain mappings if exact name differs
    if (idx === -1) {
      if (k.includes('fragment')) idx = 0
      else if (k.includes('fiber') || k.includes('fibre')) idx = 1
      else if (k.includes('foam')) idx = 2
      else if (k.includes('film')) idx = 3
      else if (k.includes('sheet')) idx = 4
    }
    return idx
  }

  // Compute the final data to display (Filtered or Full)
  const chartData = computed(() => {
    const defaultCats = ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']
    const categories = props.options.xaxis?.categories || defaultCats

    // If no filter, return data as-is
    if (!props.filterKey) {
      return { series: props.series, categories }
    }

    // If filter exists, try to slice the data
    const idx = getCategoryIndex(props.filterKey, categories)

    if (idx >= 0) {
      return {
        // Map series to only include the specific data point
        series: props.series.map(s => ({
          ...s,
          data: [Array.isArray(s.data) ? (s.data[idx] || 0) : 0],
        })),
        // Update Category label to match
        categories: [categories[idx]],
      }
    }

    // Fallback if filter not found
    return { series: props.series, categories }
  })

  const chartOptions = computed(() => {
    // 1. Define safe defaults
    const defaults = {
      chart: {
        height: props.height,
        toolbar: { show: false },
        fontFamily: 'inherit',
      },
      plotOptions: {
        bar: {
          dataLabels: { position: 'top' }, // Default to top if not specified
        },
      },
      dataLabels: {
        enabled: true,
        style: { colors: ['#1f2937'], fontWeight: 600 },
        offsetY: -20, // Slight lift for top labels
      },
      xaxis: {
        categories: chartData.value.categories, // Inject dynamic categories
      },
    }

    return {
      ...defaults,
      ...props.options,
      chart: { ...defaults.chart, ...props.options.chart },
      plotOptions: {
        bar: { ...defaults.plotOptions.bar, ...props.options.plotOptions?.bar },
      },
      xaxis: {
        ...props.options.xaxis,
        categories: chartData.value.categories, // Force override categories based on filter
      },
    }
  })
</script>

<template>
  <div class="chart-container">
    <div v-if="title || subtitle || date" class="header">
      <h4 v-if="title" class="title">{{ title }}</h4>
      <p v-if="subtitle || date" class="subtitle">{{ subtitle || date }}</p>
    </div>

    <ApexChartBase :height="height" :options="chartOptions" :series="chartData.series" type="bar" />
  </div>
</template>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 4px;
  line-height: 1.2;
}

.subtitle {
  font-size: 0.875rem;
  color: #9ca3af;
  /* Tailwind gray-400 */
  margin-bottom: 8px;
}
</style>
