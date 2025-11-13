<script setup>
import { ref, computed, watch } from 'vue'
import { VIcon } from 'vuetify/components'

const props = defineProps({
    categories: { type: Array, required: true },
    totals: { type: Array, required: true },
    drilldown: { type: [Object, Array], required: true },
    title: { type: String, default: 'Overview' },
    categoryLabels: { type: Array, default: () => ['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets'] },
    colors: { type: Object, default: () => ({}) },
    overviewColors: { type: Array, default: () => [] },
    useOverviewColors: { type: Boolean, default: false },
    height: { type: Number, default: 400 },
    date: { type: String, default: '' }
})

const siteNames = computed(() => props.categories || [])
const totalBySite = computed(() => props.totals || [])
const siteCategoryLabels = computed(() => props.categoryLabels)

const defaultDate = computed(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))

const overviewSeries = ref([{ name: 'Total MP', data: totalBySite.value }])
const overviewOptions = ref({
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, height: props.height },
    xaxis: {
        categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value,
        type: 'category',
        labels: { rotate: -12, rotateAlways: false, hideOverlappingLabels: false, trim: false, style: { fontSize: '12px' } }
    },
    colors: ['#1976d2'],
    plotOptions: { bar: { horizontal: false } },
    legend: { position: 'top' }
})

if (props.useOverviewColors && props.overviewColors.length) {
    overviewOptions.value.plotOptions = { bar: { horizontal: false, distributed: true } }
    overviewOptions.value.colors = props.overviewColors
}

const isDrilldown = ref(false)
const currentSiteIndex = ref(null)
const currentSiteName = ref('')

const drilldownSeries = ref([])
const drilldownOptions = ref({})

const displayedSeries = computed(() => (isDrilldown.value ? drilldownSeries.value : overviewSeries.value))
const displayedOptions = computed(() => (isDrilldown.value ? drilldownOptions.value : overviewOptions.value))

const chartRef = ref(null)
const chartKey = ref(0)

function handleSiteClick(idx) {
    if (idx == null || idx < 0 || idx >= siteNames.value.length) return
    const name = siteNames.value[idx] || `Item ${idx + 1}`
    currentSiteIndex.value = idx
    currentSiteName.value = name

    let details = []
    if (Array.isArray(props.drilldown)) details = props.drilldown[idx] || []
    else if (props.drilldown && typeof props.drilldown === 'object') details = props.drilldown[name] || props.drilldown[idx] || []

    const siteData = siteCategoryLabels.value.map((_, i) => details[i] || 0)

    drilldownSeries.value = [{ name: currentSiteName.value, data: siteData }]

    const drillPlotOpts = (props.colors && Object.keys(props.colors).length) ? { bar: { horizontal: false, distributed: true } } : { bar: { horizontal: false } }

    drilldownOptions.value = {
        chart: { type: 'bar', toolbar: { show: false }, height: props.height },
        xaxis: { categories: Array.isArray(siteCategoryLabels.value) ? siteCategoryLabels.value.slice() : siteCategoryLabels.value, type: 'category' },
        plotOptions: drillPlotOpts,
        legend: { show: false }
    }

    if (props.colors && Object.keys(props.colors).length) {
        const keys = Object.keys(props.colors || {})
        const safeColor = (c) => (c && typeof c === 'string') ? c : '#9e9e9e'
        const colorsArr = siteCategoryLabels.value.map(label => {
            const lower = (label || '').toLowerCase()
            const candidates = [lower, lower + 's']
            if (lower.endsWith('s')) candidates.push(lower.slice(0, -1))
            candidates.push(label)
            for (const c of candidates) {
                const matchKey = keys.find(k => k.toLowerCase() === (c || '').toLowerCase())
                if (matchKey) return safeColor(props.colors[matchKey])
            }
            return '#9e9e9e'
        })
        drilldownOptions.value.colors = colorsArr
    }

    if (chartRef.value && typeof chartRef.value.updateOptions === 'function') {
        try {
            chartRef.value.updateOptions({ xaxis: drilldownOptions.value.xaxis, plotOptions: drilldownOptions.value.plotOptions, legend: drilldownOptions.value.legend }, true, true)
            if (typeof chartRef.value.updateSeries === 'function') chartRef.value.updateSeries(drilldownSeries.value)
            isDrilldown.value = true
        } catch (e) {
            console.warn('ApexChart update failed', e)
            isDrilldown.value = true
            chartKey.value += 1
        }
    } else {
        isDrilldown.value = true
    }
}

function resetSiteDrilldown() {
    if (chartRef.value && typeof chartRef.value.updateOptions === 'function') {
        try {
            chartRef.value.updateOptions({ xaxis: overviewOptions.value.xaxis, plotOptions: overviewOptions.value.plotOptions, legend: overviewOptions.value.legend }, true, true)
            if (typeof chartRef.value.updateSeries === 'function') chartRef.value.updateSeries(overviewSeries.value)
        } catch (e) {
            console.warn('ApexChart update failed', e)
            chartKey.value += 1
        }
    }
    isDrilldown.value = false
    currentSiteIndex.value = null
    currentSiteName.value = ''
}

overviewOptions.value.chart.events = {
    dataPointSelection(_, __, config) {
        if (!isDrilldown.value) handleSiteClick(config.dataPointIndex)
    }
}

watch([() => props.categories, () => props.totals], () => {
    overviewSeries.value = [{ name: 'Total MP', data: totalBySite.value }]
    overviewOptions.value.xaxis = { categories: Array.isArray(siteNames.value) ? siteNames.value.slice() : siteNames.value, type: 'category' }
    if (!overviewOptions.value.plotOptions) overviewOptions.value.plotOptions = { bar: { horizontal: false } }
    if (chartRef.value && typeof chartRef.value.updateOptions === 'function') {
        try {
            chartRef.value.updateOptions({ xaxis: overviewOptions.value.xaxis, plotOptions: overviewOptions.value.plotOptions, colors: overviewOptions.value.colors, legend: overviewOptions.value.legend }, true, true)
            if (typeof chartRef.value.updateSeries === 'function') chartRef.value.updateSeries(overviewSeries.value)
        } catch (e) {
            console.warn('ApexChart update failed', e)
            chartKey.value += 1
        }
    }
})
</script>

<template>
    <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 v-if="!isDrilldown">{{ title }}</h3>
            <h3 v-else @click="resetSiteDrilldown" style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                <VIcon color="grey" style="line-height:1;">mdi-menu-left</VIcon>
                <span>Counts for {{ currentSiteName }}</span>
            </h3>
            <p class="subtitle">{{ props.date || defaultDate }}</p>
        </div>
        <apexchart :key="chartKey" ref="chartRef" :options="displayedOptions" :series="displayedSeries" type="bar"
            :height="props.height" />
    </div>
</template>

<style scoped>
.subtitle {
    color: rgb(155, 155, 155);
}
</style>
