<script setup>
import { ref, computed, watch } from 'vue'
import { VIcon } from 'vuetify/components'
import { he } from 'vuetify/locale'


const props = defineProps({
    // categories for the overview x-axis (e.g., input types or site names)
    categories: { type: Array, required: true },
    // totals array for overview bars (same length as categories)
    totals: { type: Array, required: true },
    // drilldown mapping: either an object keyed by category name -> array of counts per MP category,
    // or an array of arrays aligned with categories
    drilldown: { type: [Object, Array], required: true },
    // title for the overview
    title: { type: String, default: 'Overview' },
    // labels for the microplastic categories shown in drilldown
    categoryLabels: { type: Array, default: () => ['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets'] },
    // optional colors mapping for microplastic categories: { fragments: '#...', fibers: '#...' }
    colors: { type: Object, default: () => ({}) },
    // optional overview colors per category (for overview bars). If provided, will enable
    // distributed bar coloring so each overview bar uses the corresponding color.
    overviewColors: { type: Array, default: () => [] },
    // optional chart height in pixels
    height: { type: Number, default: 400 }
    ,
    // optional human-readable date string to display (e.g., 'September 2022' or computed string)
    date: { type: String, default: '' }
})

// Prepare names and totals
const siteNames = computed(() => props.categories || [])
const totalBySite = computed(() => props.totals || [])

const siteCategoryLabels = computed(() => props.categoryLabels)

// default date string when caller does not provide one
const defaultDate = computed(() => {
    try {
        const now = new Date()
        const options = { year: 'numeric', month: 'long', day: 'numeric' }
        return now.toLocaleDateString(undefined, options)
    } catch (e) {
        return ''
    }
})

// Overview series (totals)
const overviewSeries = ref([{ name: 'Total MP', data: totalBySite.value }])
const overviewOptions = ref({
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, height: props.height },
    // include label settings so long category names are visible (rotate slightly and avoid hiding overlapping labels)
    xaxis: {
        categories: siteNames.value,
        labels: {
            rotate: -12,
            rotateAlways: false,
            hideOverlappingLabels: false,
            trim: false,
            style: { fontSize: '12px' }
        }
    },
    // use a single blue color for the overview bars; will be restored on exit from drilldown
    colors: ['#1976d2'],
    legend: { position: 'top' }
})

// If caller provided overviewColors, use distributed bars and the provided colors array
if (props.overviewColors && props.overviewColors.length) {
    overviewOptions.value.plotOptions = { bar: { horizontal: false, distributed: true } }
    overviewOptions.value.colors = props.overviewColors
}

// Drilldown state
const isDrilldown = ref(false)
const currentSiteIndex = ref(null)
const currentSiteName = ref('')

const drilldownSeries = ref([])
const drilldownOptions = ref({})

const displayedSeries = computed(() => (isDrilldown.value ? drilldownSeries.value : overviewSeries.value))
const displayedOptions = computed(() => (isDrilldown.value ? drilldownOptions.value : overviewOptions.value))

function handleSiteClick(idx) {
    if (idx == null || idx < 0 || idx >= siteNames.value.length) return
    const name = siteNames.value[idx] || `Item ${idx + 1}`
    currentSiteIndex.value = idx
    currentSiteName.value = name

    // resolve drilldown data: support object keyed by name or array-of-arrays
    let details = []
    if (Array.isArray(props.drilldown)) {
        details = props.drilldown[idx] || []
    } else if (props.drilldown && typeof props.drilldown === 'object') {
        details = props.drilldown[name] || props.drilldown[idx] || []
    }

    // normalize length to categoryLabels
    const siteData = siteCategoryLabels.value.map((_, i) => details[i] || 0)

    drilldownSeries.value = [{ name: currentSiteName.value, data: siteData }]
    drilldownOptions.value = {
        chart: { type: 'bar', toolbar: { show: false }, height: props.height },
        xaxis: { categories: siteCategoryLabels.value },
        // Use distributed bars so ApexCharts applies the provided colors array to each data point
        plotOptions: { bar: { horizontal: false, distributed: true } },
        legend: { show: false }
    }

    // apply colors mapping if provided: map categoryLabels -> colors
    if (props.colors && Object.keys(props.colors).length) {
        // Build colors array aligned with categoryLabels. Try multiple key variants
        const colorsArr = siteCategoryLabels.value.map(label => {
            const lower = (label || '').toLowerCase()
            const keys = Object.keys(props.colors || {})
            // candidates: lower, lower + 's', if endsWith 's' try without 's'
            const candidates = [lower, lower + 's']
            if (lower.endsWith('s')) candidates.push(lower.slice(0, -1))
            // also check original label as provided
            candidates.push(label)
            let found = null
            for (const c of candidates) {
                const matchKey = keys.find(k => k.toLowerCase() === (c || '').toLowerCase())
                if (matchKey) {
                    found = props.colors[matchKey]
                    break
                }
            }
            return found || '#9e9e9e'
        })
        drilldownOptions.value.colors = colorsArr
    }

    isDrilldown.value = true
}

function resetSiteDrilldown() {
    isDrilldown.value = false
    currentSiteIndex.value = null
    currentSiteName.value = ''
}

// Attach ApexCharts click handler for overview bars
// The options object must be reactive; we attach the event for overviewOptions
overviewOptions.value.chart.events = {
    dataPointSelection: function (event, chartContext, config) {
        if (!isDrilldown.value) {
            handleSiteClick(config.dataPointIndex)
        }
    }
}

// Keep overview data in sync if props.sites changes
watch([() => props.categories, () => props.totals], () => {
    overviewSeries.value = [{ name: 'Total MP', data: totalBySite.value }]
    // only update categories so we preserve label formatting options above
    if (overviewOptions.value && overviewOptions.value.xaxis) {
        overviewOptions.value.xaxis.categories = siteNames.value
    } else {
        overviewOptions.value.xaxis = { categories: siteNames.value }
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
        <apexchart :options="displayedOptions" :series="displayedSeries" type="bar" :height="props.height" />
    </div>
</template>

<style scoped>
.subtitle {
    color: rgb(155, 155, 155);
}
</style>
