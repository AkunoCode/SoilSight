<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import directus from '@/composables/useDirectus.js'
import { readItems, customEndpoint } from '@directus/sdk'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'

const props = defineProps({
    isOverview: { type: Boolean, default: true },
    item: { type: Object, default: null },
    showGenerate: { type: Boolean, default: true },
    title: { type: String, default: 'AI Diagnosis' },
})

const emit = defineEmits(['generated'])

const { displayLatestSampleDate } = useLatestSampleDate()

const regionalReport = ref(null)
const isGenerating = ref(false)
const previousReportId = ref(null)
let pollInterval = null
const showReportDialog = ref(false)

const parsedRegionalReport = computed(() => {
    if (!regionalReport.value?.ai_report) return ''
    return regionalReport.value.ai_report
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>')
})

const reportPreview = computed(() => {
    if (props.isOverview) {
        if (!regionalReport.value?.ai_report) return ''
        let raw = regionalReport.value.ai_report.replace(/\*\*/g, '').replace(/[#*-]/g, '')
        return raw.length > 350 ? raw.substring(0, 350) + '...' : raw
    }
    return props.item?.ai_summary || ''
})

const rawSummaryText = computed(() => {
    if (props.isOverview) return regionalReport.value?.ai_report || null
    return props.item?.ai_summary || null
})

const formattedSummary = computed(() => {
    const raw = rawSummaryText.value
    if (!raw) return null
    return raw
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>')
})

const summaryDateLabel = computed(() => {
    if (props.isOverview && regionalReport.value) {
        return `Regional Analysis as of ${new Date(regionalReport.value.report_date || Date.now()).toLocaleDateString()}`
    } else if (!props.isOverview && props.item) {
        return `Site Analysis generated on ${displayLatestSampleDate.value}`
    }
    return 'Analysis unavailable'
})

async function fetchRegionalReport() {
    try {
        const res = await directus.request(readItems('general_summary', { sort: ['-report_date'], limit: 1 }))
        const items = Array.isArray(res) ? res : (res?.data || [])
        if (items.length > 0) {
            const latestItem = items[0]
            if (isGenerating.value) {
                if (latestItem.id !== previousReportId.value) {
                    regionalReport.value = latestItem
                    if (latestItem.ai_report && latestItem.ai_report.length > 10) {
                        isGenerating.value = false
                        stopPolling()
                    }
                }
            } else {
                regionalReport.value = latestItem
            }
        }
    } catch (e) {
        console.error('AISummary: fetchRegionalReport error', e)
    }
}

// --- FIXED FUNCTION BELOW ---
async function generateReport() {
    if (regionalReport.value?.id) previousReportId.value = regionalReport.value.id
    isGenerating.value = true
    try {
        // FIXED: Added body: JSON.stringify({}) to ensure Content-Type header is sent
        await directus.request(customEndpoint({
            path: '/flows/trigger/914be7b3-e277-4de5-baa5-1724a964521b',
            method: 'POST',
            body: JSON.stringify({})
        }))

        startPolling()
        emit('generated')
    } catch (error) {
        console.error('AISummary: generateReport failed', error)
        isGenerating.value = false
    }
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval)
    pollInterval = setInterval(() => { fetchRegionalReport() }, 5000)
}

function stopPolling() {
    if (pollInterval) clearInterval(pollInterval)
    pollInterval = null
}

onMounted(() => { if (props.isOverview) fetchRegionalReport() })
onUnmounted(() => { stopPolling() })

watch(() => props.isOverview, (nv) => { if (nv) fetchRegionalReport() })

defineExpose({ regionalReport, isGenerating, fetchRegionalReport })
</script>

<template>
    <div>
        <div class="d-flex align-center justify-space-between mb-1">
            <div class="d-flex align-center">
                <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">{{ props.title }}</h4>
            </div>
            <div class="d-flex align-center">
                <div v-if="isGenerating" class="d-flex align-center">
                    <VProgressCircular indeterminate color="primary" size="16" width="2" class="mr-2" />
                    <span class="text-caption text-primary font-weight-bold mr-2">Updating...</span>
                </div>
            </div>
        </div>

        <p class="subtitle mb-2">{{ summaryDateLabel }}</p>

        <div v-if="isGenerating && !formattedSummary"
            class="summary-box d-flex flex-column align-center justify-center py-6">
            <p class="text-body-2 text-grey-darken-1 mb-0">Generating Smart Report...</p>
            <p class="text-caption text-grey">This may take a few moments.</p>
        </div>

        <div v-else-if="formattedSummary" class="summary-box">
            <template v-if="props.isOverview">
                <div class="text-body-2 text-grey-darken-3 preserve-newlines mb-2">{{ reportPreview }}</div>
                <div class="d-flex align-center mt-1" style="gap: 8px;">
                    <VBtn color="primary" variant="text" @click="showReportDialog = true"
                        prepend-icon="mdi-book-open-page-variant">Read Full Report</VBtn>
                    <VBtn color="primary" variant="outlined" :loading="isGenerating" :disabled="isGenerating"
                        @click="generateReport" prepend-icon="mdi-refresh">Regenerate</VBtn>
                </div>
            </template>
            <template v-else>
                <div class="preserve-newlines scrollable-summary" v-html="formattedSummary"></div>
            </template>
        </div>

        <div v-else class="summary-box d-flex flex-column align-center justify-center py-6">
            <p class="text-body-1 mb-3">No regional analysis available.</p>
            <VBtn v-if="showGenerate" color="primary" prepend-icon="mdi-creation" @click="generateReport">Generate
                Analysis
            </VBtn>
        </div>

        <VDialog v-model="showReportDialog" max-width="800" scrollable>
            <VCard>
                <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-grey-lighten-4">
                    <div class="d-flex align-center">
                        <VIcon color="primary" class="mr-2">mdi-google-analytics</VIcon>
                        <span class="text-h6 font-weight-bold">Regional Intelligence Report</span>
                    </div>
                    <VBtn icon="mdi-close" variant="text" @click="showReportDialog = false"></VBtn>
                </VCardTitle>
                <VDivider></VDivider>

                <VCardText class="pa-6" style="min-height: 300px;">
                    <div v-if="regionalReport" class="text-body-1">
                        <div class="d-flex gap-4 mb-6">
                            <VChip color="primary" label>{{ new Date(regionalReport.report_date).toLocaleDateString() }}
                            </VChip>
                            <VChip variant="outlined"><strong>{{ regionalReport.total_farms_analyzed
                                    }}</strong>&nbsp;Farms
                            </VChip>
                            <VChip variant="outlined" color="red"><strong>{{ regionalReport.total_pollution_count
                                    }}</strong>&nbsp;Particles</VChip>
                        </div>
                        <div class="report-content" v-html="parsedRegionalReport"></div>
                    </div>
                </VCardText>

                <VDivider></VDivider>
                <VCardActions class="pa-4">
                    <VSpacer></VSpacer>
                    <VBtn color="primary" variant="outlined" :loading="isGenerating" :disabled="isGenerating"
                        @click="generateReport" prepend-icon="mdi-refresh">Regenerate</VBtn>
                    <VBtn color="primary" variant="elevated" @click="showReportDialog = false">Close</VBtn>
                </VCardActions>
            </VCard>
        </VDialog>
    </div>
</template>

<style scoped>
.summary-box {
    background-color: #f9f9f9;
    border-left: 4px solid #366ECE;
    padding: 1em;
    border-radius: 0em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.scrollable-summary {
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
}

.preserve-newlines {
    white-space: pre-wrap;
}

.preserve-newlines :deep(li) {
    margin-left: 1.5em;
    margin-bottom: 0.5em;
}

.report-content :deep(li) {
    margin-left: 1.5em;
    margin-bottom: 0.5em;
}
</style>