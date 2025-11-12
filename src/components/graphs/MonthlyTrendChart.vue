<script setup>
import { computed, ref, watch, toRef } from 'vue'
import { buildMonthlyChartData } from './monthlyTrend.js'

const props = defineProps({
    microplasticData: { type: Object, required: true },
    date: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    height: { type: Number, default: 400 },
    colors: { type: Object, default: () => ({}) }
})

const height = toRef(props, 'height')

const defaultDate = computed(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))

const totals = computed(() => ({
    fragments: props.microplasticData?.fragments || 0,
    fibers: props.microplasticData?.fibers || 0,
    foams: props.microplasticData?.foams || 0,
    films: props.microplasticData?.films || 0,
    pellets: props.microplasticData?.pellets || 0
}))

const { series: baseSeries, options: baseOptions } = buildMonthlyChartData(totals.value)
baseOptions.chart = Object.assign({}, baseOptions.chart || {}, { height: props.height })
const monthlySeries = ref(baseSeries)
const monthlyOptions = ref(baseOptions)

// chart instance ref so updates can be applied via API
const chartRef = ref(null)

if (props.colors && Object.keys(props.colors).length) monthlyOptions.value.colors = Object.values(props.colors)

watch(totals, (nv) => {
    const { series, options } = buildMonthlyChartData(nv)
    monthlySeries.value = series
    options.chart = Object.assign({}, options.chart || {}, { height: props.height })
    monthlyOptions.value = options
    if (props.colors && Object.keys(props.colors).length) monthlyOptions.value.colors = Object.values(props.colors)

    if (chartRef.value && typeof chartRef.value.updateOptions === 'function') {
        try {
            chartRef.value.updateOptions(monthlyOptions.value, false, true)
            if (typeof chartRef.value.updateSeries === 'function') chartRef.value.updateSeries(monthlySeries.value)
        } catch (e) {
            console.warn('MonthlyTrendChart: chart update failed', e)
        }
    }
})
</script>

<template>
    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Total Monthly Microplastic Waste per Morphological Category</h3>
            <p class="subtitle">{{ subtitle || (props.date || defaultDate) }}</p>
        </div>
        <apexchart ref="chartRef" :options="monthlyOptions" :series="monthlySeries" type="line" :height="height" />
    </div>
</template>

<style scoped>
.subtitle {
    color: rgb(155, 155, 155)
}
</style>
