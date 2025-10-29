<script setup>
import { ref, computed, watch } from 'vue'
import { VIcon } from 'vuetify/components'

const props = defineProps({
    sites: { type: Array, required: true },
})

// Prepare names and totals
const siteNames = computed(() => props.sites.map(s => s.site_name || ''))
const totalBySite = computed(() => props.sites.map(s => (
    (s.fragment_count || 0) +
    (s.fiber_count || 0) +
    (s.film_count || 0) +
    (s.foam_count || 0) +
    (s.beads_count || 0)
)))

const siteCategoryLabels = ['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']

// Overview series (totals)
const overviewSeries = ref([{ name: 'Total MP', data: totalBySite.value }])
const overviewOptions = ref({
    chart: { type: 'bar', stacked: true, toolbar: { show: false } },
    xaxis: { categories: siteNames.value },
    legend: { position: 'top' }
})

// Drilldown state
const isDrilldown = ref(false)
const currentSiteIndex = ref(null)
const currentSiteName = ref('')

const drilldownSeries = ref([])
const drilldownOptions = ref({})

const displayedSeries = computed(() => (isDrilldown.value ? drilldownSeries.value : overviewSeries.value))
const displayedOptions = computed(() => (isDrilldown.value ? drilldownOptions.value : overviewOptions.value))

function handleSiteClick(idx) {
    if (idx == null || idx < 0 || idx >= props.sites.length) return
    const s = props.sites[idx]
    currentSiteIndex.value = idx
    currentSiteName.value = s.site_name || `Site ${idx + 1}`

    const siteData = [
        s.fragment_count || 0,
        s.fiber_count || 0,
        s.foam_count || 0,
        s.film_count || 0,
        s.beads_count || 0,
    ]

    drilldownSeries.value = [{ name: currentSiteName.value, data: siteData }]
    drilldownOptions.value = {
        chart: { type: 'bar', toolbar: { show: false } },
        xaxis: { categories: siteCategoryLabels },
        plotOptions: { bar: { horizontal: false } },
        legend: { show: false }
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
watch([() => props.sites], () => {
    overviewSeries.value = [{ name: 'Total MP', data: totalBySite.value }]
    overviewOptions.value.xaxis = { categories: siteNames.value }
})
</script>

<template>
    <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 v-if="!isDrilldown">Microplastic Count by Farm Site</h3>
            <h3 v-else @click="resetSiteDrilldown" style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                <VIcon color="grey" style="line-height:1;">mdi-menu-left</VIcon>
                <span>Counts for {{ currentSiteName }}</span>
            </h3>
        </div>
        <apexchart :options="displayedOptions" :series="displayedSeries" type="bar" />
    </div>
</template>
