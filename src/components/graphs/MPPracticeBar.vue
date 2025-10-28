<script setup>
import VueApexCharts from 'vue3-apexcharts'
import { toRef } from 'vue'

const props = defineProps({
    series: { type: Array, required: true },
    options: { type: Object, required: true },
    title: { type: String, required: false, default: '' },
    subtitle: { type: String, required: false, default: '' },
    height: { type: [String, Number], required: false, default: 300 }
})

const seriesRef = toRef(props, 'series')
const optionsRef = toRef(props, 'options')
</script>

<template>
    <div class="d-flex flex-column">
        <h4 class="text-h6 font-weight-bold mb-1" style="line-height: 1.2em;" v-if="title">{{ title }}</h4>
        <p class="subtitle mb-2" v-if="subtitle">{{ subtitle }}</p>
        <div>
            <VueApexCharts type="bar" :height="height" :options="optionsRef" :series="seriesRef" />
        </div>
    </div>
</template>

<style scoped>
/* Minimal styles — previewCard supplies shared styles for consistency */
</style>
