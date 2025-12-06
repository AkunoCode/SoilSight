<script setup>
import { computed } from 'vue'
import ApexChartBase from './ApexChartBase.vue'
import { CHART_COLORS } from '@/config/chartPalette.js'

const props = defineProps({
    // Expects array: [{ category: '< 100 µm', count: 150 }, ...]
    data: { type: Array, default: () => [] },
    height: { type: [Number, String], default: 350 },
    loading: { type: Boolean, default: false }
})

const BINS = [
    { label: '< 100 µm', desc: 'Critical: Root Uptake', color: CHART_COLORS[0] || '#85A4D6' },
    { label: '100-500 µm', desc: 'High: Soil Fauna', color: CHART_COLORS[1] || '#4A7DD3' },
    { label: '> 1 mm', desc: 'Low: Physical Blockage', color: CHART_COLORS[2] || '#2154AB' },
]

const chartData = computed(() => {
    const rows = props.data || []

    // Normalize incoming categories for matching
    const norm = (v) => (v || '').toString().toLowerCase().replace(/\s+/g, '')

    const dataByBin = BINS.map(bin => {
        const match = rows.find(r => {
            const cat = r.category || r.size_category
            return norm(cat) === norm(bin.label)
        })
        return match ? (match.count || match.mp_count || 0) : 0
    })

    const categoriesWithDesc = BINS.map(b => `${b.label} - ${b.desc}`)

    return {
        categories: categoriesWithDesc,
        series: [{ name: 'Particles Found', data: dataByBin }]
    }
})

const colors = BINS.map(b => b.color)

const chartOptions = computed(() => ({
    chart: {
        type: 'bar',
        height: props.height,
        toolbar: { show: false },
        fontFamily: 'inherit'
    },
    plotOptions: {
        bar: {
            distributed: true, // Allows different colors per bar
            borderRadius: 4,
            columnWidth: '55%',
            dataLabels: {
                position: 'top', // Show numbers on top of bars
            }
        }
    },
    colors: colors,
    dataLabels: {
        enabled: true,
        offsetY: -20,
        style: { fontSize: '12px', colors: ['#304758'] }
    },
    xaxis: {
        categories: chartData.value.categories,
        title: { text: 'Particle Size Range' },
        labels: {
            style: { fontSize: '11px', fontWeight: 600 }
        }
    },
    yaxis: {
        title: { text: 'Count of Microplastics' },
        labels: {
            formatter: (val) => val.toFixed(0)
        }
    },
    tooltip: {
        y: {
            formatter: (val) => val + " particles"
        }
    },
    legend: { show: false },
    grid: {
        padding: { top: 20 }
    }
}))
</script>

<template>
    <div class="risk-chart-container">
        <div class="header">
            <h4 class="title">Biological Risk Assessment</h4>
            <p class="subtitle">Size distribution analysis for crop uptake potential</p>
        </div>

        <div class="chart-content" :style="{ minHeight: height + 'px' }">
            <div v-if="loading" class="state">Analyzing sizes...</div>
            <div v-else-if="!data.length" class="state">No size data available</div>

            <ApexChartBase v-else :height="height" :options="chartOptions" :series="chartData.series" type="bar" />
        </div>
    </div>
</template>

<style scoped>
.risk-chart-container {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.header {
    margin-bottom: 12px;
}

.title {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 2px;
}

.subtitle {
    font-size: 0.85rem;
    color: #64748b;
}

.state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
}
</style>