<script setup>
import VueApexCharts from 'vue3-apexcharts'
import { toRef, computed } from 'vue'

const props = defineProps({
    series: { type: Array, required: true },
    options: { type: Object, required: true },
    title: { type: String, required: false, default: '' },
    subtitle: { type: String, required: false, default: '' },
})

const seriesRef = toRef(props, 'series')
const optionsRef = toRef(props, 'options')

// Apply a conservative default: if caller didn't specify bar dataLabel position
// we'll set it to 'top' and enable a small offset; otherwise respect caller options.
const mergedOptions = computed(() => {
    const base = optionsRef.value || {}

    // shallow copy of plotOptions so we can safely modify bar/dataLabels without deep merging
    const plotOptions = Object.assign({}, base.plotOptions || {})
    plotOptions.bar = Object.assign({}, plotOptions.bar || {})

    // If caller did not set a dataLabels position for bar, default to 'top'
    const callerBarDLPos = plotOptions.bar.dataLabels && plotOptions.bar.dataLabels.position
    if (!callerBarDLPos) {
        plotOptions.bar.dataLabels = Object.assign({}, plotOptions.bar.dataLabels || {}, { position: 'top' })
    }

    // If caller didn't provide a top-level dataLabels config, provide a sensible default
    const callerDL = base.dataLabels
    const dataLabels = callerDL ? callerDL : { enabled: true, style: { colors: ['#1f2937'], fontWeight: '600' } }

    // Return a shallow-merged options object; don't deep-merge caller's internals beyond the bar/dataLabels defaults above
    // Ensure toolbar is hidden by default unless caller explicitly sets it
    const chart = Object.assign({}, base.chart || {})
    if (!chart.toolbar) chart.toolbar = { show: false }

    return Object.assign({}, base, { chart, plotOptions, dataLabels })
})
</script>

<template>
    <div class="d-flex flex-column">
        <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;" v-if="title">{{ title }}</h4>
        <p class="subtitle mb-2" v-if="subtitle">{{ subtitle }}</p>
        <div>
            <VueApexCharts type="bar" :options="mergedOptions" :series="seriesRef" />
        </div>
    </div>
</template>

<style scoped>
/* Minimal styles — previewCard supplies shared styles for consistency */
</style>
