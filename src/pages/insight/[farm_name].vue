<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PreviewCard from '../../components/PreviewCard.vue'
import SampledFarms from '../../components/SampledFarms.vue'
import LeafletMap from '../../components/LeafletMap.vue'
import dummyData from '../../assets/dummyData.json'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'

// reactive state
const route = useRoute()
const sites = (dummyData && dummyData.sites) || []
const farmParam = computed(() => route.params.farm_name || '')
const farm = ref(null)

const aiSummaryText = `Soil analysis from Green Valley’s high-value crop farms indicates that fragments are the dominant form of microplastics, followed by films. This pattern is likely linked to the widespread use of plastic mulching, as the color and texture of the detected films correspond to mulching sheets and seedling trays commonly used in the area. The farms’ clay loam soil structure may also contribute to microplastic retention, while irrigation water is a possible additional source of contamination.

These findings suggest heightened risks of soil degradation, reduced microbial activity, and potential transfer of microplastics into the food chain through crop uptake. Over time, this could undermine both soil health and agricultural productivity.

It is recommended that farmers adopt more sustainable practices such as reducing reliance on single-use plastics, improving waste collection and disposal, and exploring biodegradable alternatives for mulching and seedling propagation. Regular monitoring of both soil and irrigation water quality is also advised to mitigate long-term risks.
`

const formattedDate = computed(() => {
    const now = new Date()
    const options = { year: 'numeric', month: 'long', day: 'numeric' }
    return now.toLocaleDateString(undefined, options)
})

const plasticActivityList = [
    "Plastic Fertilizer Sacks",
    "Plastic Mulching",
    "Seedling Trays (plastic)",
    "Compost with visible plastics",
    "Greenhouse plastic sheets/tunnels"
]

const cultivationDefinitions = {
    "Fully Organic": "An agricultural practice that avoids the use of synthetic chemicals and fertilizers, relying instead on natural processes and materials to maintain soil fertility and control pests.",
    "Integrated": "A sustainable approach to managing pests that combines biological, cultural, mechanical, and chemical methods to minimize environmental impact while effectively controlling pest populations.",
    "Conventional": "A traditional farming method that typically involves the use of synthetic chemicals, fertilizers, and pesticides to maximize crop yields.",
}

// helper to normalize / slugify names for matching
function slugify(str) {
    if (!str) return ''
    return String(str)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
}

// normalize activity names for reliable matching
function normalizeActivityName(s) {
    if (!s) return ''
    return String(s)
        .toLowerCase()
        // remove parentheses and their contents
        .replace(/\([^)]*\)/g, '')
        // remove punctuation except spaces
        .replace(/[^a-z0-9\s]/g, '')
        // remove the word "plastic" as it's often present or absent in different sources
        .replace(/\bplastic\b/g, '')
        // collapse whitespace
        .replace(/\s+/g, ' ')
        .trim()
}

// computed set of normalized activities for the current farm
const farmNormalizedActivities = computed(() => {
    const items = farm.value?.plastic_activity || []
    return new Set(items.map(normalizeActivityName).filter(Boolean))
})

function farmHasActivity(activity) {
    if (!activity) return false
    return farmNormalizedActivities.value.has(normalizeActivityName(activity))
}

// determine an appropriate icon name for the farm's water source
import { computed as _computed } from 'vue'
import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'
const waterIcon = _computed(() => {
    const ws = (farm.value?.water_source || '').toLowerCase()
    if (!ws) return 'mdi-water'
    if (/rain/.test(ws)) return 'mdi-weather-rainy'
    if (/well|groundwater|deep well/.test(ws)) return 'mdi-water-pump'
    if (/municipal|supply|city/.test(ws)) return 'mdi-city'
    if (/irrigation|canal/.test(ws)) return 'mdi-waves'
    return 'mdi-water'
})

function findFarmByParam(param) {
    if (!param) return null
    const decoded = decodeURIComponent(String(param))
    const key = slugify(decoded)
    // try exact slug match first
    let found = sites.find(s => slugify(s.site_name) === key)
    if (found) return found
    // try case-insensitive name match
    found = sites.find(s => (s.site_name || '').toLowerCase() === decoded.toLowerCase())
    if (found) return found
    // try contains
    found = sites.find(s => (s.site_name || '').toLowerCase().includes(decoded.toLowerCase()))
    return found || null
}

// initialize
function updateFarm() {
    farm.value = findFarmByParam(farmParam.value) || null
}

watch(farmParam, () => updateFarm(), { immediate: true })

onMounted(() => {
    // initial set (redundant because of watch immediate, but safe)
    updateFarm()
})

const printReport = () => {
    window.print()
}

// build microplastic data shape expected by MPDonutChart from farm counts
const microplasticData = computed(() => {
    const f = farm.value || {}
    return {
        fragments: Number(f.fragment_count || 0),
        fibers: Number(f.fiber_count || 0),
        foams: Number(f.foam_count || 0),
        films: Number(f.film_count || 0),
        pellets: Number(f.beads_count || 0)
    }
})

// Prepare anonymized site comparison data (compare current farm to other organic farms)
const mpColors = {
    fragments: '#0B2E4E',
    fibers: '#19568E',
    films: '#63B3FF',
    foams: '#4688C7',
    pellets: '#B9DDFF'
}

const organicSites = computed(() => {
    const arr = (sites || []).filter(s => (s.cultivation_practice || '').toLowerCase().includes('organic'))
    // ensure current farm is included (avoid duplicates)
    const fid = farm.value?.id
    if (fid && !arr.find(s => s.id === fid)) {
        const ffull = sites.find(s => s.id === fid)
        if (ffull) arr.unshift(ffull)
    }
    return arr
})

const anonymizedComparison = computed(() => {
    const list = organicSites.value || []
    const categories = []
    const totals = []
    const drilldown = []
    let anonIdx = 0
    for (const s of list) {
        const total = (s.fragment_count || 0) + (s.fiber_count || 0) + (s.film_count || 0) + (s.foam_count || 0) + (s.beads_count || 0)
        totals.push(total)
        drilldown.push([s.fragment_count || 0, s.fiber_count || 0, s.foam_count || 0, s.film_count || 0, s.beads_count || 0])
        if (s.id === farm.value?.id) {
            categories.push(s.site_name || 'This Farm')
        } else {
            const letter = String.fromCharCode(65 + (anonIdx % 26))
            categories.push(`Farm ${letter}`)
            anonIdx++
        }
    }
    return { categories, totals, drilldown }
})

// Overview colors: highlight the current farm, gray out others
const overviewColors = computed(() => {
    const cats = anonymizedComparison.value.categories || []
    return cats.map(name => (name === (farm.value?.site_name || '') ? '#1976d2' : '#bdbdbd'))
})

// Build per-farm synthetic distributions for color and size ranges so we can reuse SiteDrilldownChart
const colorBuckets = ['Gray', 'Blue', 'White', 'Transparent']
const colorBucketRatios = [0.35, 0.3, 0.2, 0.15]

const farmTotalMP = computed(() => {
    const d = microplasticData.value
    return (d.fragments || 0) + (d.fibers || 0) + (d.foams || 0) + (d.films || 0) + (d.pellets || 0)
})

const colorComparison = computed(() => {
    const totals = colorBucketRatios.map(r => Math.round((farmTotalMP.value || 0) * r))
    // drilldown: for each color bucket, split into MP categories proportional to farm's MP category counts
    const mp = microplasticData.value
    const mpTotal = farmTotalMP.value || 0
    const drilldown = totals.map(t => {
        if (mpTotal === 0 || t === 0) return [0, 0, 0, 0, 0]
        const fragments = Math.round(t * ((mp.fragments || 0) / mpTotal))
        const fibers = Math.round(t * ((mp.fibers || 0) / mpTotal))
        const foams = Math.round(t * ((mp.foams || 0) / mpTotal))
        const films = Math.round(t * ((mp.films || 0) / mpTotal))
        const pellets = Math.max(0, t - (fragments + fibers + foams + films))
        return [fragments, fibers, foams, films, pellets]
    })
    return { categories: colorBuckets, totals, drilldown }
})

const sizeRanges = ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm']
const sizeRatios = [0.12, 0.28, 0.35, 0.15, 0.1]
const sizeComparison = computed(() => {
    const totals = sizeRatios.map(r => Math.round((farmTotalMP.value || 0) * r))
    const mp = microplasticData.value
    const mpTotal = farmTotalMP.value || 0
    const drilldown = totals.map(t => {
        if (mpTotal === 0 || t === 0) return [0, 0, 0, 0, 0]
        const fragments = Math.round(t * ((mp.fragments || 0) / mpTotal))
        const fibers = Math.round(t * ((mp.fibers || 0) / mpTotal))
        const foams = Math.round(t * ((mp.foams || 0) / mpTotal))
        const films = Math.round(t * ((mp.films || 0) / mpTotal))
        const pellets = Math.max(0, t - (fragments + fibers + foams + films))
        return [fragments, fibers, foams, films, pellets]
    })
    return { categories: sizeRanges, totals, drilldown }
})
</script>

<template>
    <div class="insight-page">
        <div class="d-flex align-center justify-space-between mb-8">
            <div class="d-flex flex-column">
                <div class="d-flex align-center">
                    <VIcon style="cursor:pointer; vertical-align:middle;" @click="$router.back()" color="grey"
                        size="x-large">
                        mdi-menu-left</VIcon>
                    <h1 class="title mb-0">{{ farm?.site_name }}</h1>
                </div>
                <p class="text-h5 ml-8">{{ farm?.address }}</p>
            </div>
            <div class="d-flex align-center justify-center bg-blue pa-4 px-6 rounded-lg cursor-pointer"
                style=" box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
                <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
                <p class="text-h4 text-white font-weight-bold">Print Report</p>
            </div>
        </div>
        <VRow>
            <VCol cols="4">
                <div class="card">
                    <h3 class="text-h5 font-weight-bold">Geographic Location</h3>
                    <p class="mb-2">{{ farm?.latitude }}, {{ farm?.longitude }}</p>
                    <div v-if="farm?.latitude != null && farm?.longitude != null">
                        <LeafletMap :lat="farm?.latitude" :lng="farm?.longitude" :zoom="13" />
                    </div>
                    <div v-else class="card">
                        <p>No coordinates available for this farm.</p>
                    </div>
                </div>
            </VCol>
            <VCol cols="5">
                <VRow>
                    <VCol cols="8">
                        <div class="card">
                            <h3 class="text-h5 font-weight-bold mb-4">{{ farm?.cultivation_practice }} Farming</h3>
                            <p>{{ cultivationDefinitions[farm?.cultivation_practice] }}</p>
                        </div>
                    </VCol>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h5 font-weight-bold mb-4">Crops Grown</h3>
                            <div class="crops-list">
                                <ul>
                                    <li v-for="(crop, index) in farm?.crops" :key="index">{{ crop }}</li>
                                </ul>
                            </div>
                        </div>
                    </VCol>
                </VRow>
                <VRow>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h6 font-weight-bold text-center">Land Area </h3>
                            <p class="text-h3 font-weight-bold text-center">{{ farm?.land_area_ha }}</p>
                            <p class="text-h5 font-weight-bold text-center">hectares</p>
                        </div>
                    </VCol>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h6 font-weight-bold text-center">Water Source</h3>
                            <div class="icon-container bg-blue">
                                <VIcon color="white" size="x-large">{{ waterIcon }}</VIcon>
                            </div>
                            <p class="text-h5 font-weight-bold text-center">
                                {{
                                    farm?.water_source }}
                            </p>
                        </div>
                    </VCol>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h6 font-weight-bold text-center">Soil Texture</h3>
                            <div class="icon-container bg-brown">
                                <VIcon color="white" size="x-large">mdi-image-filter-hdr</VIcon>
                            </div>
                            <p class="text-h5 font-weight-bold text-center">{{ farm?.soil_type }}</p>
                        </div>
                    </VCol>
                </VRow>
            </VCol>
            <VCol cols="3">
                <div class="card">
                    <h3 class="text-h5 font-weight-bold mb-4">Plastic-Related Activities</h3>
                    <!-- Template for each item in Plastic Activity List check if the farm does it -->
                    <template v-for="activity in plasticActivityList" :key="activity">
                        <div class="d-flex align-center justify-space-between mb-2">
                            <p>{{ activity }}</p>
                            <VIcon :color="farmHasActivity(activity) ? 'green' : 'red'" size="large">
                                {{ farmHasActivity(activity) ? 'mdi-check-circle' :
                                    'mdi-close-circle' }}
                            </VIcon>
                        </div>
                        <div class="horizontal-bar"></div>
                    </template>
                </div>
            </VCol>
        </VRow>
        <VRow>
            <VCol cols="5">
                <div class="d-flex flex-column ga-4">
                    <div class="card">
                        <MPDonutChart :microplasticData="microplasticData" />
                    </div>
                    <div class="card">
                        <SiteDrilldownChart :categories="anonymizedComparison.categories"
                            :totals="anonymizedComparison.totals" :drilldown="anonymizedComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="320" :overview-colors="overviewColors"
                            :title="farm?.cultivation_practice ? `Contamination Comparison to Other ${farm.cultivation_practice} Farms` : 'Contamination Comparison to Other Farms'" />
                    </div>
                    <div class="card">
                        <div class="d-flex align-center mb-1">
                            <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">
                                AI Summary
                            </h4>
                            <VIcon size="small" color="primary" class="ml-2">mdi-creation</VIcon>
                        </div>
                        <p class="subtitle">Data as of {{ formattedDate }}</p>
                        <div class="summary-box">
                            <p class="preserve-newlines">{{ aiSummaryText }}</p>
                        </div>
                    </div>
                </div>
            </VCol>
            <VCol cols="7">
                <div class="d-flex flex-column ga-4">
                    <MonthlyTrendChart :siteId="farm?.id" :title="`Monthly Microplastic Trend for ${farm?.site_name}`"
                        :height="320" />
                    <div class="card">
                        <SiteDrilldownChart :categories="colorComparison.categories" :totals="colorComparison.totals"
                            :drilldown="colorComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="260" title="Microplastic Count by Color" />
                    </div>
                    <div class="card">
                        <SiteDrilldownChart :categories="sizeComparison.categories" :totals="sizeComparison.totals"
                            :drilldown="sizeComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="260" title="Microplastic Count by Size Range" />
                    </div>
                </div>
            </VCol>
        </VRow>
    </div>
</template>

<style scoped>
.insight-page {
    padding: 2em;
    background-color: #f2f2f8;
}

.card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
    height: 100%;
}

.horizontal-bar {
    height: 1px;
    background-color: #e0e0e0;
    margin-top: 8px;
    margin-bottom: 12px;
}

.crops-list {
    max-height: 70px;
    overflow-y: auto;
}

.icon-container {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    margin: 0 auto 0px auto;
}

.summary-box {
    background-color: #f9f9f9;
    padding: 15px;
    border-radius: 6px;
    margin-top: 10px;
    max-height: 180px;
    overflow-y: auto;
}

.preserve-newlines {
    white-space: pre-wrap;
}
</style>