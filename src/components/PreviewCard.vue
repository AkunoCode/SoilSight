<script setup>
import { tooltip } from "leaflet";
import { ref } from "vue";
import VueApexCharts from "vue3-apexcharts";

defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, required: false, default: "" }
});

const dummyData = {
    fragments: 648000,
    fibers: 405000,
    foams: 324000,
    films: 162000,
    pellets: 81000
};

const barChartDummySeries = ref([
    {
        name: "Conventional Practice",
        data: [650, 420, 350, 190, 210]
    },
    {
        name: "Organic Practice",
        data: [480, 300, 270, 130, 150]
    },
    {
        name: "Integrated Practice",
        data: [500, 440, 280, 110, 80]
    }
]);

// Store original bar chart data for filtering
const originalBarChartData = [
    {
        name: "Conventional Practice",
        data: [650, 420, 350, 190, 210]
    },
    {
        name: "Organic Practice",
        data: [480, 300, 270, 130, 150]
    },
    {
        name: "Integrated Practice",
        data: [500, 440, 280, 110, 80]
    }
];

const total = Object.values(dummyData).reduce((a, b) => a + b, 0);

const percentages = {
    fragments: Math.round((dummyData.fragments / total) * 100),
    fibers: Math.round((dummyData.fibers / total) * 100),
    foams: Math.round((dummyData.foams / total) * 100),
    films: Math.round((dummyData.films / total) * 100),
    pellets: Math.round((dummyData.pellets / total) * 100)
};

const colors = {
    fibers: "#19568E",
    fragments: "#0B2E4E",
    films: "#63B3FF",
    foams: "#4688C7",
    pellets: "#B9DDFF"
};

const labelsMap = {
    fragments: "Fragments",
    fibers: "Fibers",
    foams: "Foams",
    films: "Films",
    pellets: "Pellets"
};

const aiSummaryText = `The analysis of microplastic contamination in Tayabas City agricultural soils reveals a significant presence of microplastics, with fragments being the most prevalent type, constituting 40% of the total microplastics found. Fibers account for 25%, followed by foams at 20%, films at 10%, and pellets at 5%. The data indicates that conventional farming practices contribute to higher levels of microplastic contamination compared to organic and integrated practices. This suggests that the use of plastic materials in conventional agriculture, such as plastic mulches and packaging, may be a major source of microplastic pollution in these soils. The findings highlight the need for sustainable farming practices and improved waste management to mitigate microplastic contamination in agricultural environments. Further research is recommended to explore the long-term effects of microplastics on soil health and crop productivity.`;

// Chart options
const donutChartOptions = ref({
    chart: { type: "donut", height: 350 },
    labels: ["Fragments", "Fibers", "Foams", "Films", "Pellets"],
    colors: Object.values(colors),
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
        pie: {
            donut: {
                size: "70%",
                labels: {
                    show: true,
                    name: { show: true, fontSize: "16px" },
                    value: { show: true, fontSize: "22px", fontWeight: "bold" },
                    total: {
                        show: true,
                        label: "Average number\nof MP found",
                        fontSize: "14px",
                        formatter: function (w) {
                            const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);

                            // Format number to millions
                            if (total >= 1_000_000) {
                                return (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
                            } else if (total >= 1_000) {
                                return (total / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
                            }
                            return total; // if below 1K
                        }
                    }
                }
            }
        }
    }
});

const barChartOptions = ref({
    chart: {
        type: "bar",
        height: 300,
        toolbar: { show: false }
    },
    colors: ["#19568E", "#63B3FF", "#0B2E4E"],
    plotOptions: {
        bar: {
            horizontal: false,
            columnWidth: "55%",
            distributed: false,
            dataLabels: { position: "top" }
        }
    },
    dataLabels: {
        enabled: true
    },
    stroke: {
        show: true,
        width: 2,
        colors: ["transparent"]
    },
    xaxis: {
        categories: [
            "Fragments",
            "Fibers",
            "Foam",
            "Films",
            "Pellets"
        ]
    },
    yaxis: { title: { text: "Number of MP found (in Thousands)" }, min: 0, max: 700 },
    legend: { show: true, position: "bottom", horizontalAlign: "left", offsetX: 40 },
    fill: { opacity: 1 },
    tooltip: {
        y: {
            formatter: function (val) {
                return val + " thousands";
            }
        }
    }
});

const donutChart = ref(null);

// Track selected key
const selectedKey = ref(null);

// Dragging functionality for the entire preview card
const isDragging = ref(false);
const previewCard = ref(null);
const dragStartY = ref(0);
const cardPosition = ref(-80); // Starting position: 10vh from bottom
const hasMoved = ref(false); // Track if mouse has moved during click
const isAnimating = ref(false); // Track if we're in a toggle animation

const startDrag = (event) => {
    // Only start drag if clicking specifically on the drag handle
    if (!event.target.closest('.drag-handle')) return;

    isDragging.value = true;
    hasMoved.value = false;
    isAnimating.value = false; // Disable animation during drag
    dragStartY.value = event.clientY;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
};

const onDrag = (event) => {
    if (!isDragging.value) return;

    const deltaY = dragStartY.value - event.clientY;
    const viewportHeight = window.innerHeight;
    const deltaVh = (deltaY / viewportHeight) * 100;

    // Mark that we've moved if there's significant movement
    if (Math.abs(deltaVh) > 0.5) {
        hasMoved.value = true;
    }

    let newPosition = cardPosition.value + deltaVh;

    // Constrain between -80vh (min) and -8vh (max) from bottom
    newPosition = Math.max(-80, Math.min(-8, newPosition));

    cardPosition.value = newPosition;
    dragStartY.value = event.clientY;
};

const stopDrag = () => {
    if (isDragging.value && !hasMoved.value) {
        // If we haven't moved, toggle between min and max positions with animation
        isAnimating.value = true;
        togglePosition();

        // Reset animation flag after animation completes
        setTimeout(() => {
            isAnimating.value = false;
        }, 400); // Match the CSS transition duration
    }

    isDragging.value = false;
    hasMoved.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

const togglePosition = () => {
    // If closer to min position (-80), go to max (-8), otherwise go to min
    const currentPos = cardPosition.value;
    const midPoint = (-80 + -8) / 2; // -44

    if (currentPos <= midPoint) {
        cardPosition.value = -8; // Go to max (top)
    } else {
        cardPosition.value = -80; // Go to min (bottom)
    }
};

// Initial series = all data
const chartSeries = ref([
    dummyData.fragments,
    dummyData.fibers,
    dummyData.foams,
    dummyData.films,
    dummyData.pellets
]);

const handleLegendClick = (key) => {
    if (!donutChart.value) return;

    // Map keys to their index positions for bar chart filtering
    const keyToIndex = {
        fragments: 0,
        fibers: 1,
        foams: 2,
        films: 3,
        pellets: 4
    };

    // If clicking same key → reset
    if (selectedKey.value === key) {
        selectedKey.value = null;
        chartSeries.value = [
            dummyData.fragments,
            dummyData.fibers,
            dummyData.foams,
            dummyData.films,
            dummyData.pellets
        ];

        // Reset donut chart
        donutChartOptions.value = {
            ...donutChartOptions.value,
            labels: Object.values(labelsMap),
            colors: Object.values(colors),
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
                                label: "Average number\nof MP found",
                                fontSize: "14px",
                                formatter: function (w) {
                                    return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                }
                            }
                        }
                    }
                }
            }
        };

        // Reset bar chart
        barChartDummySeries.value = [...originalBarChartData];
        barChartOptions.value = {
            ...barChartOptions.value,
            xaxis: {
                categories: [
                    "Fragments",
                    "Fibers",
                    "Foam",
                    "Films",
                    "Pellets"
                ]
            }
        };
        return;
    }

    // Otherwise show only one slice/category
    selectedKey.value = key;
    chartSeries.value = [dummyData[key]];

    // Update donut chart
    donutChartOptions.value = {
        ...donutChartOptions.value,
        labels: [labelsMap[key]],
        colors: [colors[key]],
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
                            label: labelsMap[key], // change center label
                            fontSize: "14px",
                            formatter: function () {
                                return dummyData[key];
                            }
                        }
                    }
                }
            }
        }
    };

    // Update bar chart to show only selected category
    const selectedIndex = keyToIndex[key];
    barChartDummySeries.value = originalBarChartData.map(series => ({
        ...series,
        data: [series.data[selectedIndex]]
    }));

    barChartOptions.value = {
        ...barChartOptions.value,
        xaxis: {
            categories: [labelsMap[key]]
        }
    };
};
</script>

<template>
    <div ref="previewCard" :class="['preview-card', { 'no-transition': isDragging || !isAnimating }]" :style="{
        bottom: `${cardPosition}vh`,
        cursor: isDragging ? 'grabbing' : 'default'
    }">
        <!-- Drag Handle -->
        <div class="drag-handle" @mousedown="startDrag">
            <VIcon size="small" color="grey-darken-1">mdi-drag-horizontal</VIcon>
        </div>

        <!-- Card Header -->
        <div class="d-flex flex-column mb-4 card-header">
            <div class="d-flex align-center justify-space-between">
                <h3 class="title">{{ title }}</h3>
                <VIcon color="grey" size="large">mdi-arrow-expand-all</VIcon>
            </div>
            <p class="subtitle" v-if="subtitle">{{ subtitle }}</p>
        </div>

        <!-- Card Content -->
        <div class="card-content">
            <div class="d-flex align-center mb-4">
                <!-- Average Microplastic Waste per Morphological Category -->
                <VRow>
                    <VCol cols="7">
                        <div class="d-flex flex-column">
                            <div class="d-flex flex-column">
                                <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">
                                    Average Microplastic Waste <br />per Morphological Category
                                </h4>
                                <p class="subtitle mb-2">Data as of September 22, 2025</p>
                            </div>
                            <VueApexCharts ref="donutChart" type="donut" :options="donutChartOptions"
                                :series="chartSeries" height="300" />
                        </div>
                    </VCol>

                    <!-- Custom Legend -->
                    <VCol cols="5">
                        <div class="d-flex flex-column">
                            <template v-for="(value, key) in dummyData" :key="key">
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
            </div>
            <!-- Contamination Comparison by Farm Practices -->
            <div class="d-flex flex-column mt-4">
                <div class="d-flex flex-column">
                    <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;">
                        Contamination Comparison by Farm Practices
                    </h4>
                    <p class="subtitle mb-2">Data as of September 22, 2025</p>
                    <div>
                        <VueApexCharts type="bar" height="300" :options="barChartOptions"
                            :series="barChartDummySeries" />
                    </div>
                </div>
            </div>
            <!-- AI Summary -->
            <div class="d-flex flex-column mt-4">
                <div class="d-flex flex-column">
                    <div class="d-flex align-center mb-1">
                        <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">
                            AI Summary
                        </h4>
                        <VIcon size="small" color="primary" class="ml-2">mdi-creation</VIcon>
                    </div>
                    <p class="subtitle mb-2">Generated on September 22, 2025</p>
                    <div class="summary-box">
                        <p>{{ aiSummaryText }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.preview-card {
    position: fixed;
    right: 20px;
    background: white;
    padding: 1em 1.5em;
    border-radius: 1em 1em 0 0;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.385);
    width: 600px;
    z-index: 1000;
    user-select: none;
    transition: box-shadow 0.2s ease, bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-card.no-transition {
    transition: box-shadow 0.2s ease;
}

.preview-card:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
}

.drag-handle {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5em;
    margin: -1em -1.5em 1em -1.5em;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 1em 1em 0 0;
    cursor: grab;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    transition: background-color 0.2s ease;
}

.drag-handle:hover {
    background: rgba(0, 0, 0, 0.08);
}

.drag-handle:active {
    cursor: grabbing;
    background: rgba(0, 0, 0, 0.12);
}

.card-header {
    /* Additional styles if needed */
}

.card-content {
    height: 85vh;
    overflow-y: auto;
    /* remove the scrollbar */
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* Internet Explorer and Edge */
    overflow-x: visible;
    padding-bottom: 5em;
}

.title {
    margin: 0;
    font-weight: bold;
    font-size: 2em;
}

.subtitle {
    margin: 0;
    color: #666;
    font-size: 0.9em;
}



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

.summary-box {
    background-color: #f9f9f9;
    border-left: 4px solid #19568E;
    padding: 1em;
    border-radius: 0em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
