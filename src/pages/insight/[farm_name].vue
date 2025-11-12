<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PreviewCard from '../../components/PreviewCard.vue'
import SampledFarms from '../../components/SampledFarms.vue'
import LeafletMap from '../../components/LeafletMap.vue'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'

// Directus
import directus from '@/composables/useDirectus'
import { readItems } from '@directus/sdk'

// reactive state
const route = useRoute()
// sites will be populated from Directus if needed
const sites = []
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

// Return a definition based on whether the practice string contains keywords.
function getCultivationDefinition(practice) {
    if (!practice) return ''
    // if an exact key exists, return it
    if (cultivationDefinitions[practice]) return cultivationDefinitions[practice]
    const p = String(practice).toLowerCase()
    if (p.includes('organic')) return cultivationDefinitions['Fully Organic'] || ''
    if (p.includes('integrated')) return cultivationDefinitions['Integrated'] || ''
    if (p.includes('conventional')) return cultivationDefinitions['Conventional'] || ''
    return ''
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
// handle water_source which may be a string or an array
const waterIcon = _computed(() => {
    const raw = farm.value?.water_source
    let ws = ''
    if (Array.isArray(raw)) {
        ws = raw.join(' ').toLowerCase()
    } else {
        ws = (raw || '').toLowerCase()
    }

    if (!ws) return 'mdi-water'
    if (/rain/.test(ws)) return 'mdi-weather-rainy'
    if (/well|groundwater|deep well/.test(ws)) return 'mdi-water-pump'
    if (/municipal|supply|city/.test(ws)) return 'mdi-city'
    if (/irrigation|canal/.test(ws)) return 'mdi-waves'
    return 'mdi-water'
})

// helper to show array fields (water_source, soil_type) consistently in the template
function formatArrayField(val) {
    if (val == null) return ''
    if (Array.isArray(val)) return val.join(', ')
    return String(val)
}

// Title-case helpers for display consistency (strings or arrays)
function titleCaseString(s) {
    if (s == null) return ''
    const str = String(s).toLowerCase()
    // Capitalize each word; keep simple rules (words separated by spaces or hyphens)
    return str.split(/(\s|\-)/).map(part => {
        // keep separators unchanged
        if (/^\s|\-$/g.test(part)) return part
        return part.charAt(0).toUpperCase() + part.slice(1)
    }).join('')
}

function titleCase(val) {
    if (val == null) return ''
    if (Array.isArray(val)) return val.map(v => titleCaseString(v)).join(', ')
    return titleCaseString(val)
}

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

// Try to fetch the farm from Directus by name; if that fails, leave farm null.
async function fetchFarmFromDirectus(param) {
    if (!param) return null
    const decoded = decodeURIComponent(String(param))

    try {
        // First attempt: query Directus for an exact site_name match (fast if indexed)
        const resp = await directus.request(readItems('sites', { filter: { site_name: { _eq: decoded } }, limit: 1 }))
        const items = Array.isArray(resp) ? resp : (resp?.data || [])
        if (items && items.length > 0) {
            // keep local cache of sites for other comparisons
            sites.splice(0, sites.length, ...items)
            return items[0]
        }

        // Second attempt: fetch all sites from Directus and match by slug locally
        const allResp = await directus.request(readItems('sites'))
        const allItems = Array.isArray(allResp) ? allResp : (allResp?.data || [])
        if (Array.isArray(allItems) && allItems.length > 0) {
            sites.splice(0, sites.length, ...allItems)
            // try matching using the same local logic
            const key = slugify(decoded)
            let found = allItems.find(s => slugify(s.site_name) === key)
            if (found) return found
            found = allItems.find(s => (s.site_name || '').toLowerCase() === decoded.toLowerCase())
            if (found) return found
            found = allItems.find(s => (s.site_name || '').toLowerCase().includes(decoded.toLowerCase()))
            if (found) return found
        }
    } catch (err) {
        console.error('Directus lookup failed for farm:', err)
    }

    return null
}



const printReport = () => {
    window.print()
}

// Latest soil sample date for this farm (from Directus soilsamples collection)
const latestSampleDate = ref(null)

function formatDateISO(dateStr) {
    if (!dateStr) return ''
    try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    } catch (e) {
        return ''
    }
}

async function fetchLatestSampleDateForFarm(farmId) {
    latestSampleDate.value = null
    if (!farmId) return null
    try {
        // Try to fetch the most recent sample for this site
        const resp = await directus.request(readItems('soilsamples', { filter: { site: { _eq: farmId } }, sort: ['-date_collected'], limit: 1 }))
        const items = Array.isArray(resp) ? resp : (resp?.data || [])
        const sample = (items && items[0]) || null
        console.log('Fetched latest soilsample for farm', farmId, sample)
        latestSampleDate.value = sample?.date_collected || null
    } catch (err) {
        console.error('Error fetching latest soilsample for farm', farmId, err)
        latestSampleDate.value = null
    }
    return latestSampleDate.value
}

// computed display date: prefer latestSampleDate, fallback to current formattedDate
const displaySampleDate = computed(() => {
    const d = latestSampleDate.value
    const formatted = formatDateISO(d)
    return formatted || formattedDate.value
})

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

watch(farmParam, async () => {
    // fetch the farm record from Directus whenever the route param changes
    farm.value = await fetchFarmFromDirectus(farmParam.value)
    console.log('Loaded farm data:', farm.value)
}, { immediate: true })

// When the farm object is set, fetch the latest soil sample date
watch(farm, async (newFarm) => {
    if (newFarm?.id) {
        await fetchLatestSampleDateForFarm(newFarm.id)
        console.log('Latest sample date:', latestSampleDate.value)
    } else {
        latestSampleDate.value = null
    }
}, { immediate: true })

onMounted(() => {
    // nothing else to do here; watch will fetch immediately
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
                            <h3 class="text-h5 font-weight-bold mb-4">{{ titleCase(farm?.cultivation_practice) }}
                                Farming</h3>
                            <p>{{ getCultivationDefinition(farm?.cultivation_practice) }}</p>
                        </div>
                    </VCol>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h5 font-weight-bold mb-4">Crops Grown</h3>
                            <div class="crops-list">
                                <ul>
                                    <li v-for="(crop, index) in farm?.crops" :key="index">{{ titleCase(crop) }}</li>
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
                            <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm?.water_source) }}
                            </p>
                        </div>
                    </VCol>
                    <VCol cols="4">
                        <div class="card">
                            <h3 class="text-h6 font-weight-bold text-center">Soil Texture</h3>
                            <div class="icon-container bg-brown">
                                <VIcon color="white" size="x-large">mdi-image-filter-hdr</VIcon>
                            </div>
                            <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm?.soil_type) }}</p>
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
                        <MPDonutChart :microplasticData="microplasticData" :date="displaySampleDate" />
                    </div>
                    <div class="card">
                        <SiteDrilldownChart :categories="anonymizedComparison.categories"
                            :totals="anonymizedComparison.totals" :drilldown="anonymizedComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="320" :overview-colors="overviewColors" :date="displaySampleDate"
                            :title="farm?.cultivation_practice ? `Contamination Comparison to Other ${titleCase(farm?.cultivation_practice)} Farms` : 'Contamination Comparison to Other Farms'" />
                    </div>
                    <div class="card">
                        <div class="d-flex align-center mb-1"
                            style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center;">
                                <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">
                                    AI Summary
                                </h4>
                                <VIcon size="small" color="primary" class="ml-2">mdi-creation</VIcon>
                            </div>
                            <p class="subtitle mb-0">{{ displaySampleDate }}</p>
                        </div>
                        <div class="summary-box">
                            <p class="preserve-newlines">{{ aiSummaryText }}</p>
                        </div>
                    </div>
                </div>
            </VCol>
            <VCol cols="7">
                <div class="d-flex flex-column ga-4">
                    <MonthlyTrendChart :siteId="farm?.id" :title="`Monthly Microplastic Trend for ${farm?.site_name}`"
                        :height="320" :date="displaySampleDate" />
                    <div class="card">
                        <SiteDrilldownChart :categories="colorComparison.categories" :totals="colorComparison.totals"
                            :drilldown="colorComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="260" :date="displaySampleDate" title="Microplastic Count by Color" />
                    </div>
                    <div class="card">
                        <SiteDrilldownChart :categories="sizeComparison.categories" :totals="sizeComparison.totals"
                            :drilldown="sizeComparison.drilldown"
                            :categoryLabels="['Fragments', 'Fibers', 'Foam', 'Films', 'Pellets']" :colors="mpColors"
                            :height="260" :date="displaySampleDate" title="Microplastic Count by Size Range" />
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

.subtitle {
    color: rgb(155, 155, 155);
}
</style>