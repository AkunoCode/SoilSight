<script setup>
import { computed, defineProps } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { CHART_COLORS } from '@/config/chartPalette.js'

const props = defineProps({
    sites: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    height: { type: [Number, String], default: 350 },
    // Subtitle/Title props removed since we are removing the card header
})

// --- 1. DATA NORMALIZATION & PROCESSING ---

function normalizeActivityName(activity) {
    if (!activity) return ''
    let normalized = String(activity).toLowerCase().trim()

    // Clean up "plastic" keywords
    normalized = normalized.replace(/\bplastic\s+/gi, '').replace(/\s+plastic\b/gi, '').trim()

    const variations = {
        'Seedling Tray': ['seedling tray', 'seedling trays', 'trays'],
        'Mulching': ['mulching', 'mulch'],
        'Greenhouse': ['greenhouse sheet', 'greenhouse', 'greenhouse plastic'],
        'Sacks': ['fertilizer sacks', 'fertilizer sack', 'sacks', 'sack'],
        'Irrigation': ['irrigation', 'tubing', 'drip tape', 'pipes'],
        'Compost': ['compost', 'compost with plastic', 'compost remains'],
    }

    for (const [canonical, synonyms] of Object.entries(variations)) {
        if (synonyms.some(syn => normalized.includes(syn))) return canonical
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const chartSeries = computed(() => {
    if (!props.sites?.length) return []

    const plasticShapes = ['Fragments', 'Fibers', 'Foams', 'Films', 'Sheets']
    const activityMap = new Map()
    const processedActivities = new Set()

    props.sites.forEach(site => {
        if (!site) return

        let activities = []
        const raw = site.plastic_activity || site.plasticActivity

        if (Array.isArray(raw)) {
            activities = raw.map(normalizeActivityName)
        } else if (typeof raw === 'string' && raw.trim()) {
            activities = raw.includes(',') ? raw.split(',').map(normalizeActivityName) : [normalizeActivityName(raw)]
        }

        activities = [...new Set(activities.filter(a => a))]
        if (!activities.length) return

        const counts = {
            fragments: Number(site.fragment_count) || 0,
            fibers: Number(site.fiber_count) || 0,
            foams: Number(site.foam_count) || 0,
            films: Number(site.film_count) || 0,
            sheets: (Number(site.sheets_count) || Number(site.sheet_count) || 0)
        }

        const splitFactor = activities.length

        activities.forEach(activity => {
            processedActivities.add(activity)
            if (!activityMap.has(activity)) {
                activityMap.set(activity, { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 })
            }
            const entry = activityMap.get(activity)
            Object.keys(counts).forEach(key => entry[key] += counts[key] / splitFactor)
        })
    })

    const sortedActivities = Array.from(processedActivities).sort()

    return sortedActivities.map(activity => {
        const data = activityMap.get(activity)
        return {
            name: activity,
            data: plasticShapes.map(shape => ({
                x: shape,
                y: Math.round(data[shape.toLowerCase()] || 0)
            }))
        }
    })
})

const hasData = computed(() => chartSeries.value.length > 0)

// --- 2. DYNAMIC SCALING ---

const dataRange = computed(() => {
    if (!hasData.value) return { min: 0, max: 100 }
    let minVal = Infinity, maxVal = 0

    chartSeries.value.forEach(s => s.data.forEach(p => {
        if (p.y < minVal) minVal = p.y
        if (p.y > maxVal) maxVal = p.y
    }))

    const padding = (maxVal - minVal) * 0.1 || 10
    return { min: Math.max(0, minVal - padding), max: maxVal + padding }
})

// --- 3. CHART CONFIGURATION ---

const chartOptions = computed(() => ({
    chart: {
        type: 'heatmap',
        height: props.height,
        toolbar: { show: false },
        fontFamily: 'inherit',
        parentHeightOffset: 0, // Reduces padding issues in strict layouts
    },
    plotOptions: {
        heatmap: {
            shadeIntensity: 0.5,
            radius: 4,
            useFillColorAsStroke: false,
            colorScale: {
                ranges: [
                    { from: 0, to: 0, name: 'None', color: '#F8FAFC' },
                    { from: 1, to: Math.round(dataRange.value.max * 0.25), name: 'Low', color: CHART_COLORS[0] || '#81C784' },
                    { from: Math.round(dataRange.value.max * 0.25) + 1, to: Math.round(dataRange.value.max * 0.5), name: 'Moderate', color: CHART_COLORS[1] || '#FFB74D' },
                    { from: Math.round(dataRange.value.max * 0.5) + 1, to: Math.round(dataRange.value.max * 0.75), name: 'High', color: CHART_COLORS[2] || '#E57373' },
                    { from: Math.round(dataRange.value.max * 0.75) + 1, to: dataRange.value.max + 1000, name: 'Critical', color: CHART_COLORS[3] || '#C62828' }
                ]
            }
        }
    },
    dataLabels: { enabled: true, style: { colors: ['#000'] } },
    stroke: { width: 1, colors: ['#fff'] },
    legend: { position: 'bottom' },
    xaxis: { type: 'category', position: 'top', title: { text: 'Plastic Type' } },
    yaxis: { title: { text: 'Source' } },
    grid: { padding: { right: 20, left: 10 } }
}))
</script>

<template>
    <div class="heatmap-container" :style="{ minHeight: props.height + 'px' }">


        <div v-if="loading" class="state-container">
            <div class="loader"></div>
            <span>Analyzing correlation data...</span>
        </div>

        <div v-else-if="!hasData" class="state-container">
            <span class="icon">🔍</span>
            <p>No activity data available.</p>
        </div>

        <VueApexCharts v-else type="heatmap" :height="height" :options="chartOptions" :series="chartSeries" />
    </div>
</template>

<style scoped>
.heatmap-container {
    width: 100%;
    position: relative;
    /* Removed card styles (border, shadow, radius) */
}

.state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    /* Tailwind slate-400 equivalent */
    font-size: 0.9rem;
    /* Ensure state container takes up the full height prop */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
}

.icon {
    font-size: 1.8rem;
    margin-bottom: 8px;
    opacity: 0.6;
}

/* Minimal Loader */
.loader {
    border: 2px solid #f1f5f9;
    border-radius: 50%;
    border-top: 2px solid #3b82f6;
    /* Blue-500 */
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
    margin-bottom: 8px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>