<script setup>
import { computed, ref, watch, toRef } from 'vue'
import { buildMonthlyChartData } from './monthlyTrend.js'
// Directus
import directus from '@/composables/useDirectus'
import { readItems } from '@directus/sdk'

const props = defineProps({
    microplasticData: { type: Object, required: false, default: () => ({}) },
    siteId: { type: [String, Number], required: false },
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

// aggregated monthly data coming from soilsamples for a given site (if provided)
const soilsampleMonthly = ref(null)

const { series: baseSeries, options: baseOptions } = buildMonthlyChartData(totals.value)
baseOptions.chart = Object.assign({}, baseOptions.chart || {}, { height: props.height })
const monthlySeries = ref(baseSeries)
const monthlyOptions = ref(baseOptions)

// chart instance ref so updates can be applied via API
const chartRef = ref(null)

if (props.colors && Object.keys(props.colors).length) monthlyOptions.value.colors = Object.values(props.colors)

// If soilsample-based monthly aggregation is available use that, otherwise fall back to distribution build
watch([totals, soilsampleMonthly], (nv) => {
    const soil = soilsampleMonthly.value
    if (soil && soil.months && soil.series) {
        monthlySeries.value = soil.series
        monthlyOptions.value = Object.assign({}, monthlyOptions.value || {}, { xaxis: { categories: soil.months }, chart: Object.assign({}, monthlyOptions.value?.chart || {}, { height: props.height }) })
        if (props.colors && Object.keys(props.colors).length) monthlyOptions.value.colors = Object.values(props.colors)
    } else {
        const { series, options } = buildMonthlyChartData(totals.value)
        monthlySeries.value = series
        options.chart = Object.assign({}, options.chart || {}, { height: props.height })
        monthlyOptions.value = options
        if (props.colors && Object.keys(props.colors).length) monthlyOptions.value.colors = Object.values(props.colors)
    }

    if (chartRef.value && typeof chartRef.value.updateOptions === 'function') {
        try {
            chartRef.value.updateOptions(monthlyOptions.value, false, true)
            if (typeof chartRef.value.updateSeries === 'function') chartRef.value.updateSeries(monthlySeries.value)
        } catch (e) {
            console.warn('MonthlyTrendChart: chart update failed', e)
        }
    }
})

// fetch soilsamples for a site and aggregate counts by month
async function fetchSoilsamplesMonthly(siteId) {
    soilsampleMonthly.value = null
    if (!siteId) return null
    try {
        const resp = await directus.request(readItems('soilsamples', { filter: { site: { _eq: siteId } }, limit: -1 }))
        const items = Array.isArray(resp) ? resp : (resp?.data || [])
        if (!items || items.length === 0) return null

        const monthMap = new Map()

        function getCountField(item, keys) {
            for (const k of keys) if (item[k] != null) return Number(item[k] || 0)
            return 0
        }

        for (const s of items) {
            const dateRaw = s.date_collected || s.sample_date || s.date || null
            let d = null
            try { d = dateRaw ? new Date(dateRaw) : null } catch { d = null }
            if (!d || isNaN(d.getTime())) continue
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!monthMap.has(key)) monthMap.set(key, { fragments: 0, fibers: 0, foams: 0, films: 0, pellets: 0 })
            const agg = monthMap.get(key)
            agg.fragments += getCountField(s, ['fragment_count', 'fragments', 'fragmentCount'])
            agg.fibers += getCountField(s, ['fiber_count', 'fibers', 'fiberCount'])
            agg.foams += getCountField(s, ['foam_count', 'foams', 'foamCount'])
            agg.films += getCountField(s, ['film_count', 'films', 'filmCount'])
            agg.pellets += getCountField(s, ['beads_count', 'pellets', 'beadsCount'])
        }

        const keys = Array.from(monthMap.keys()).sort()
        if (keys.length === 0) return null
        const months = keys.map(k => {
            const [y, m] = k.split('-')
            const date = new Date(Number(y), Number(m) - 1, 1)
            return date.toLocaleString(undefined, { month: 'short', year: 'numeric' })
        })

        const series = [
            { name: 'Fragments', data: keys.map(k => monthMap.get(k).fragments) },
            { name: 'Fibers', data: keys.map(k => monthMap.get(k).fibers) },
            { name: 'Foam', data: keys.map(k => monthMap.get(k).foams) },
            { name: 'Films', data: keys.map(k => monthMap.get(k).films) },
            { name: 'Pellets', data: keys.map(k => monthMap.get(k).pellets) }
        ]

        soilsampleMonthly.value = { months, series }
        return soilsampleMonthly.value
    } catch (err) {
        console.error('MonthlyTrendChart: error fetching soilsamples', err)
        soilsampleMonthly.value = null
        return null
    }
}

// watch siteId and re-fetch soilsamples
watch(() => props.siteId, (nv) => {
    if (nv) fetchSoilsamplesMonthly(nv)
}, { immediate: true })
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
