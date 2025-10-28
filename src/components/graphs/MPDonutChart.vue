<script setup>
import { ref, computed, watch } from 'vue';
import VueApexCharts from 'vue3-apexcharts';

const props = defineProps({
    microplasticData: { type: Object, required: true },
    labelsMap: { type: Object, required: false, default: () => ({ fragments: 'Fragments', fibers: 'Fibers', foams: 'Foams', films: 'Films', pellets: 'Pellets' }) },
    colors: { type: Object, required: false, default: () => ({ fibers: '#19568E', fragments: '#0B2E4E', films: '#63B3FF', foams: '#4688C7', pellets: '#B9DDFF' }) },
    // parent can control selection via this prop; null means no selection
    activeKey: { type: [String, null], required: false, default: null }
});

const emit = defineEmits(['selection']);

// Series and totals
const chartSeries = computed(() => [
    props.microplasticData.fragments || 0,
    props.microplasticData.fibers || 0,
    props.microplasticData.foams || 0,
    props.microplasticData.films || 0,
    props.microplasticData.pellets || 0
]);

const total = computed(() => chartSeries.value.reduce((a, b) => a + b, 0));

const percentages = computed(() => {
    const t = total.value;
    if (t === 0) return { fragments: 0, fibers: 0, foams: 0, films: 0, pellets: 0 };
    return {
        fragments: Math.round(((props.microplasticData.fragments || 0) / t) * 100),
        fibers: Math.round(((props.microplasticData.fibers || 0) / t) * 100),
        foams: Math.round(((props.microplasticData.foams || 0) / t) * 100),
        films: Math.round(((props.microplasticData.films || 0) / t) * 100),
        pellets: Math.round(((props.microplasticData.pellets || 0) / t) * 100)
    };
});

// Chart state
const selectedKey = ref(null);
const chartKey = ref(0);
const donutChart = ref(null);

// Reactive display series (for filtering)
const displaySeries = ref([...chartSeries.value]);
watch(chartSeries, (newSeries) => {
    if (selectedKey.value === null) {
        displaySeries.value = newSeries;
    }
}, { immediate: true });

const donutChartOptions = ref({
    chart: {
        type: 'donut',
        height: 350,
        events: {
            dataPointSelection: function (event, chartContext, config) {
                const dataPointIndex = config.dataPointIndex;
                const indexToKey = ['fragments', 'fibers', 'foams', 'films', 'pellets'];
                const clickedKey = indexToKey[dataPointIndex];
                if (selectedKey.value === null) {
                    // delegate selection handling locally
                    handleLegendClick(clickedKey);
                }
            }
        }
    },
    labels: Object.values(props.labelsMap),
    colors: Object.values(props.colors),
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
        pie: {
            donut: {
                size: '70%',
                labels: {
                    show: true,
                    name: { show: true, fontSize: '16px' },
                    value: { show: true, fontSize: '22px', fontWeight: 'bold' },
                    total: {
                        show: true,
                        label: 'Total number\nof MP found',
                        fontSize: '14px',
                        formatter: defaultTotalFormatter
                    }
                }
            }
        }
    }
});

// Default total formatter reused when resetting the chart options
function defaultTotalFormatter(w) {
    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
    if (total >= 1_000_000) {
        return (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (total >= 1_000) {
        return (total / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return total;
}

const clearSelections = () => {
    selectedKey.value = null;
    displaySeries.value = [...chartSeries.value];
    chartKey.value++;
    // try to clear apex selections if available
    setTimeout(() => {
        try {
            if (donutChart.value && donutChart.value.clearSelections) donutChart.value.clearSelections();
            else if (donutChart.value && donutChart.value.chart && donutChart.value.chart.clearSelections) donutChart.value.chart.clearSelections();
        } catch (e) {
            // silent
        }
    }, 100);
    // Reset options (labels, colors, and total formatter) back to defaults
    donutChartOptions.value = {
        ...donutChartOptions.value,
        labels: Object.values(props.labelsMap),
        colors: Object.values(props.colors),
        chart: {
            ...donutChartOptions.value.chart,
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    const dataPointIndex = config.dataPointIndex;
                    const indexToKey = ['fragments', 'fibers', 'foams', 'films', 'pellets'];
                    const clickedKey = indexToKey[dataPointIndex];
                    if (selectedKey.value === null) {
                        handleLegendClick(clickedKey);
                    }
                }
            }
        },
        plotOptions: {
            ...donutChartOptions.value.plotOptions,
            pie: {
                ...donutChartOptions.value.plotOptions.pie,
                donut: {
                    ...donutChartOptions.value.plotOptions.pie.donut,
                    labels: {
                        ...donutChartOptions.value.plotOptions.pie.donut.labels,
                        total: {
                            show: true,
                            label: 'Total number\nof MP found',
                            fontSize: '14px',
                            formatter: defaultTotalFormatter
                        }
                    }
                }
            }
        }
    };

    emit('selection', null);
};

// Centralized selection applier. `emitEvent` controls whether to notify parent.
const applySelection = (key, emitEvent = true) => {
    if (!key) {
        clearSelections();
        return;
    }

    if (selectedKey.value === key) {
        clearSelections();
        return;
    }

    selectedKey.value = key;
    displaySeries.value = [props.microplasticData[key] || 0];

    donutChartOptions.value = {
        ...donutChartOptions.value,
        labels: [props.labelsMap[key]],
        colors: [props.colors[key]],
        chart: {
            ...donutChartOptions.value.chart,
            events: {
                dataPointSelection: function () { return; }
            }
        },
        plotOptions: {
            ...donutChartOptions.value.plotOptions,
            pie: {
                ...donutChartOptions.value.plotOptions.pie,
                donut: {
                    ...donutChartOptions.value.plotOptions.pie.donut,
                    labels: {
                        ...donutChartOptions.value.plotOptions.pie.donut.labels,
                        total: {
                            show: true,
                            label: props.labelsMap[key],
                            fontSize: '14px',
                            formatter: function () {
                                return props.microplasticData[key] || 0;
                            }
                        }
                    }
                }
            }
        }
    };

    if (emitEvent) emit('selection', key);
};

const handleLegendClick = (key) => applySelection(key, true);

// If parent changes activeKey prop, apply it without re-emitting.
watch(() => props.activeKey, (newKey) => {
    if (newKey === selectedKey.value) return;
    applySelection(newKey, false);
});
</script>

<template>
    <VRow>
        <VCol cols="7">
            <div class="d-flex flex-column">
                <div class="d-flex flex-column">
                    <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">Total Microplastic Waste
                        <br />per Morphological
                        Category
                    </h4>
                    <p class="subtitle mb-2">Data as of September 22, 2025</p>
                </div>
                <VueApexCharts ref="donutChart" :key="chartKey" type="donut" :options="donutChartOptions"
                    :series="displaySeries" height="300" />
            </div>
        </VCol>

        <!-- Custom Legend -->
        <VCol cols="5">
            <div class="d-flex flex-column">
                <template v-for="(value, key) in microplasticData" :key="key">
                    <div class="legend-item" :style="{
                        backgroundColor: colors[key],
                        opacity: selectedKey === null || selectedKey === key ? 1 : 0.4
                    }" @click="handleLegendClick(key)">
                        <p class="font-weight-bold" style="font-size: 1.5em;">
                            {{ percentages[key] }}%
                        </p>
                        <div class="separator" />
                        <div class="d-flex flex-column" style="line-height: 1.2em;">
                            <p>{{ key.charAt(0).toUpperCase() + key.slice(1) }}</p>
                            <p class="font-weight-bold" style="font-size: 1.2em;">
                                {{ value.toLocaleString() }}
                            </p>
                        </div>
                    </div>
                </template>
            </div>
        </VCol>
    </VRow>
</template>

<style scoped>
.legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 1em;
    padding: 0.7em 1em;
    border-radius: 0.5em;
    color: white;
    cursor: pointer;
    transition: opacity 0.3s;
}

.legend-item p {
    margin: 0;
    font-size: 1em;
}

.separator {
    width: 2px;
    height: 2.5em;
    background-color: #ffffff;
    margin: 0 1em;
}
</style>
