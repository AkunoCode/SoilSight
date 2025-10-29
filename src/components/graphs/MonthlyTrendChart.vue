<script setup>
import { computed, ref, watch } from 'vue'
import { buildMonthlyChartData } from './monthlyTrend.js'

const props = defineProps({
    microplasticData: { type: Object, required: true },
    subtitle: { type: String, default: 'Data as of September 22, 2025' },
    // optional height in pixels for the chart (makes the component adjustable)
    height: { type: Number, default: 400 },
    colors: { type: Object, default: () => ({}) }
})

const totals = computed(() => ({
    fragments: props.microplasticData?.fragments || 0,
    fibers: props.microplasticData?.fibers || 0,
    foams: props.microplasticData?.foams || 0,
    films: props.microplasticData?.films || 0,
    pellets: props.microplasticData?.pellets || 0
}))

const { series: baseSeries, options: baseOptions } = buildMonthlyChartData(totals.value)
// apply requested height (default 220) to the chart options so the chart renders shorter
baseOptions.chart = Object.assign({}, baseOptions.chart || {}, { height: props.height })
const monthlySeries = ref(baseSeries)
const monthlyOptions = ref(baseOptions)

// apply colors mapping (if provided) to options.colors for ApexCharts
if (props.colors && Object.keys(props.colors).length) {
    monthlyOptions.value.colors = Object.values(props.colors)
}

watch(totals, (nv) => {
    const { series, options } = buildMonthlyChartData(nv)
    monthlySeries.value = series
    // respect the height prop when rebuilding options
    options.chart = Object.assign({}, options.chart || {}, { height: props.height })
    monthlyOptions.value = options
    if (props.colors && Object.keys(props.colors).length) {
        monthlyOptions.value.colors = Object.values(props.colors)
    }
})
</script>

<template>
    <div class="card">
        <h3>Total Monthly Microplastic Waste per Morphological Category</h3>
        <p class="subtitle">{{ subtitle }}</p>
        <apexchart :options="monthlyOptions" :series="monthlySeries" type="line" :height="props.height" />
    </div>
</template>

<style scoped>
.subtitle {
    color: rgb(155, 155, 155)
}
</style>
