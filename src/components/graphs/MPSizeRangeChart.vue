<script setup>
import { readItems } from '@directus/sdk'
import { computed, onMounted, ref, watch } from 'vue'
// Directus
import directus from '@/composables/useDirectus'
import SiteDrilldownChart from './SiteDrilldownChart.vue'

const props = defineProps({
    siteId: { type: [String, Number], required: false },
    height: { type: Number, default: 260 },
    date: { type: String, default: '' },
    title: { type: String, default: 'Microplastic Count by Size Range' },
    defaultField: { type: String, default: 'equivalent_circular_diameter_um' },
})

const measurementFields = [
    { key: 'equivalent_circular_diameter_um', label: 'Equivalent Circular Diameter (µm)' },
    { key: 'major_axis_um', label: 'Major Axis (µm)' },
    { key: 'minor_axis_um', label: 'Minor Axis (µm)' },
    { key: 'skeleton_length_um', label: 'Skeleton Length (µm)' },
    { key: 'area_um2', label: 'Area (µm²) — converted to diameter' },
    { key: 'perimeter_um', label: 'Perimeter (µm)' },
    { key: 'aspect_ratio', label: 'Aspect Ratio' },
]

const selectedField = ref(props.defaultField)

const sizeBuckets = [
    { label: '1-20 µm', min: 1, max: 20 },
    { label: '20-100 µm', min: 20, max: 100 },
    { label: '100-500 µm', min: 100, max: 500 },
    { label: '500 µm-1 mm', min: 500, max: 1000 },
    { label: '1-5 mm', min: 1000, max: 5000 },
]

const categories = computed(() => sizeBuckets.map(b => b.label))

const totals = ref([])
const drilldown = ref([])
const overviewColors = ref([])
const loading = ref(false)

function toNumber(v) {
    if (v == null || v === '') return Number.NaN
    const n = Number(v)
    return Number.isNaN(n) ? Number.NaN : n
}

function areaToDiameter(area) {
    // area in µm^2 -> diameter in µm (equivalent circular diameter)
    if (!Number.isFinite(area) || area <= 0) return Number.NaN
    return 2 * Math.sqrt(area / Math.PI)
}

function bucketForValue(val) {
    if (!Number.isFinite(val)) return -1
    for (const [i, b] of sizeBuckets.entries()) {
        if (val >= b.min && val < b.max) return i
    }
    // values >= last max go into last bucket
    if (val >= sizeBuckets.at(-1).min) return sizeBuckets.length - 1
    return -1
}

async function fetchAndAggregate(siteId, fieldKey) {
    totals.value = []
    drilldown.value = []
    overviewColors.value = []
    if (!siteId) return
    loading.value = true
    try {
        // limit to last 24 months to avoid very large client-side fetches
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - 24)
        const cutoffIso = cutoff.toISOString()
        const resp = await directus.request(readItems('microplastics', { filter: { sample_source: { site: { _eq: siteId }, date_collected: { _gte: cutoffIso } } }, limit: -1 }))
        const items = Array.isArray(resp) ? resp : (resp?.data || [])
        const counts = Array.from({ length: sizeBuckets.length }).fill(0)
        const drill = Array.from({ length: sizeBuckets.length }).fill(0).map(() => [0, 0, 0, 0, 0, 0])

        for (const it of items) {
            const raw = it[fieldKey]
            let val = toNumber(raw)
            if ((fieldKey === 'area_um2' || fieldKey === 'area') && !Number.isFinite(val) && it.area) val = toNumber(it.area)
            if (fieldKey === 'area_um2') val = areaToDiameter(val)
            // if field is perimeter or aspect_ratio we still try to bucket numerically

            if (!Number.isFinite(val)) continue

            const idx = bucketForValue(val)
            if (idx < 0) continue

            const morph = it.shape || it.morphology || it.mp_category || it.type
            const morphIdx = (function (m) {
                const mm = (m || '').toString().toLowerCase()
                if (mm.includes('fragment')) return 0
                if (mm.includes('fiber') || mm.includes('fibre')) return 1
                if (mm.includes('foam')) return 2
                if (mm.includes('film')) return 3
                if (mm.includes('sheet')) return 4
                if (mm.includes('pellet') || mm.includes('bead')) return 5
                return -1
            })(morph)

            counts[idx]++
            if (morphIdx >= 0) drill[idx][morphIdx] = (drill[idx][morphIdx] || 0) + 1
        }

        totals.value = counts
        drilldown.value = drill

        // simple color palette (add sheets color)
        overviewColors.value = ['#9e9e9e', '#1976d2', '#63B3FF', '#4688C7', '#8FD3C7', '#B9DDFF']
    } catch (error) {
        console.error('MPSizeRangeChart: fetch error', error)
    } finally {
        loading.value = false
    }
}

watch(() => props.siteId, _nv => {
    if (_nv) fetchAndAggregate(_nv, selectedField.value)
}, { immediate: true })

watch(selectedField, _nv => {
    if (props.siteId) fetchAndAggregate(props.siteId, _nv)
})

// initial values
onMounted(() => {
    if (props.siteId) fetchAndAggregate(props.siteId, selectedField.value)
})
</script>

<template>
    <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 class="text-h6 font-weight-bold" style="line-height:1.2em">{{ title }}</h4>
            <div style="display:flex; gap:8px; align-items:center; width:360px;">
                <VSelect v-model="selectedField" dense hide-details item-title="label" item-value="key"
                    :items="measurementFields" style="min-width:220px" variant="outlined" />
                <VTooltip>
                    <template #activator="{ props: slotProps }">
                        <VIcon v-bind="slotProps" color="grey" size="20">mdi-help-circle</VIcon>
                    </template>
                    <span style="max-width:240px; display:block">When "Area (µm²)" is selected we convert area to an
                        equivalent circular
                        diameter using d = 2·√(area/π). This gives a diameter-like measure that can be bucketed by
                        size.</span>
                </VTooltip>
            </div>
        </div>

        <div v-if="loading"
            :style="{ minHeight: props.height + 'px', display: 'flex', justifyContent: 'center', alignItems: 'center' }">
            <VProgressCircular color="primary" indeterminate size="28" />
        </div>

        <div v-else>
            <SiteDrilldownChart :categories="categories"
                :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']"
                :colors="{ fragments: '#0B2E4E', fibers: '#19568E', films: '#63B3FF', foams: '#4688C7', sheets: '#8FD3C7', pellets: '#B9DDFF' }"
                :date="props.date" :drilldown="drilldown" :height="props.height" :totals="totals" />
        </div>
    </div>
</template>

<style scoped>
select {
    padding: 6px 8px;
    border-radius: 4px;
}
</style>
