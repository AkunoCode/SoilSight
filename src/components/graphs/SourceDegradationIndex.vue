<script setup>
import { computed, defineProps } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { CHART_COLORS } from '@/config/chartPalette.js'

const props = defineProps({
    sites: { type: Array, default: () => [] },
    height: { type: [Number, String], default: 350 },
})

const stats = computed(() => {
    let fragments = 0
    let fibers = 0
    let foams = 0
    let films = 0
    let sheets = 0

    // Loop through all sites and sum up the morphological categories
    props.sites.forEach(s => {
        fragments += Number(s.fragment_count) || 0
        fibers += Number(s.fiber_count) || 0
        foams += Number(s.foam_count) || 0

        films += Number(s.film_count) || 0
        sheets += (Number(s.sheets_count) || Number(s.sheet_count) || 0)
    })

    const secondary = fragments + fibers + foams

    const source = films + sheets

    const totalRelevant = secondary + source

    const index = totalRelevant === 0 ? 0 : Math.round((secondary / totalRelevant) * 100)

    return {
        secondary,
        source,
        total: totalRelevant,
        index
    }
})

const severityInfo = computed(() => {
    const val = stats.value.index

    if (val < 25) return {
        label: 'Low Degradation',
        desc: 'Fresh Inputs',
        color: CHART_COLORS[0]
    }
    if (val < 50) return {
        label: 'Moderate Degradation',
        desc: 'Weathering Started',
        color: CHART_COLORS[1]
    }
    if (val < 75) return {
        label: 'High Degradation',
        desc: 'Old Accumulation',
        color: CHART_COLORS[2]
    }
    return {
        label: 'Critical Degradation',
        desc: 'Highly Fragmented',
        color: CHART_COLORS[3]
    }
})

const chartSeries = computed(() => [stats.value.index])

const chartOptions = computed(() => ({
    chart: {
        type: 'radialBar',
        height: props.height,
        fontFamily: 'inherit',
        sparkline: { enabled: false }
    },
    plotOptions: {
        radialBar: {
            startAngle: -100,
            endAngle: 100,
            hollow: { size: '60%', margin: 15 },
            track: {
                background: '#F1F5F9',
                strokeWidth: '100%',
                margin: 5
            },
            dataLabels: {
                name: {
                    show: true,
                    fontSize: '13px',
                    color: '#64748B',
                    offsetY: -10,
                    fontWeight: 600
                },
                value: {
                    show: true,
                    fontSize: '32px',
                    fontWeight: 800,
                    offsetY: 5,
                    color: severityInfo.value.color,
                    formatter: (val) => val + '%'
                }
            }
        }
    },
    fill: {
        colors: [severityInfo.value.color]
    },
    stroke: { lineCap: 'round' },
    labels: ['Fragmentation'], // The label inside the circle
}))
</script>

<template>
    <div class="gauge-container">

        <div class="gauge-header">
            <div>
                <h3 class="title">Source Degradation Index</h3>
                <p class="subtitle">Weathering & Circularity Assessment</p>
            </div>
            <div class="badge"
                :style="{ borderColor: severityInfo.color, color: severityInfo.color, backgroundColor: severityInfo.color + '15' }">
                {{ severityInfo.label }}
            </div>
        </div>

        <div class="chart-wrapper">
            <VueApexCharts :options="chartOptions" :series="chartSeries" type="radialBar" :height="height" />
        </div>

        <div class="stats-row">
            <div class="stat-item">
                <div class="stat-header">
                    <span class="dot" :style="{ background: severityInfo.color }"></span>
                    <span class="stat-label">Secondary</span>
                </div>
                <span class="stat-sublabel">(Fragments, Fibers, Foams)</span>
                <span class="stat-value" :style="{ color: severityInfo.color }">
                    {{ stats.secondary.toLocaleString() }}
                </span>
            </div>

            <div class="stat-divider"></div>

            <div class="stat-item">
                <div class="stat-header">
                    <span class="dot" style="background: #cbd5e1"></span>
                    <span class="stat-label">Source</span>
                </div>
                <span class="stat-sublabel">(Films, Sheets)</span>
                <span class="stat-value" style="color: #64748b">
                    {{ stats.source.toLocaleString() }}
                </span>
            </div>
        </div>

        <div class="legend">
            <div v-for="(color, i) in CHART_COLORS" :key="i" class="legend-item">
                <span class="legend-bar" :style="{ background: color }"></span>
                <span>{{ ['Fresh', 'Low', 'Mod', 'High', 'Crit'][i] }}</span>
            </div>
        </div>

    </div>
</template>

<style scoped>
.gauge-container {
    width: 100%;
    display: flex;
    flex-direction: column;
}

.gauge-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 5px;
}

.title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 2px 0;
}

.subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin: 0;
}

.badge {
    border: 1px solid;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.chart-wrapper {
    margin: -15px 0;
    position: relative;
    z-index: 1;
}

.stats-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-evenly;
    padding: 12px 0;
    border-top: 1px solid #f1f5f9;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 16px;
    background: #f8fafc;
    border-radius: 8px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
}

.stat-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
}

.stat-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: #334155;
}

.stat-sublabel {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-bottom: 4px;
}

.stat-value {
    font-size: 1.2rem;
    font-weight: 800;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.stat-divider {
    width: 1px;
    height: 40px;
    background: #e2e8f0;
    align-self: center;
}

.legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    opacity: 0.8;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 500;
}

.legend-bar {
    width: 24px;
    height: 4px;
    border-radius: 2px;
}
</style>