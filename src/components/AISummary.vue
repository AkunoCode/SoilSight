<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import DOMPurify from 'dompurify'
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

// --- 1. CONFIGURE DOMPURIFY ---
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
    }
})

const sanitizeConfig = {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
}

function purify(raw) {
    if (!raw) return ''
    try {
        return DOMPurify.sanitize(raw, sanitizeConfig)
    } catch (e) {
        console.error('DOMPurify failed', e)
        return ''
    }
}

// --- 2. SMART PARSING ---
function parseMarkdown(text) {
    if (!text) return ''
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/- (.*?)(<br>|\n|$)/g, '<li>$1</li>')
        .replace(/\n/g, '<br>')
}

const formattedSummary = computed(() => {
    const raw = props.isOverview ? (regionalReport.value?.ai_report || null) : (props.item?.ai_summary || null)
    if (!raw) return null

    if (/<\/?[a-z][\s\S]*>/i.test(raw)) {
        return purify(raw)
    }
    return parseMarkdown(raw)
})

const summaryDateLabel = computed(() => {
    if (props.isOverview && regionalReport.value) {
        return new Date(regionalReport.value.report_date || Date.now()).toLocaleDateString()
    } else if (!props.isOverview) {
        return displayLatestSampleDate.value || 'Recent'
    }
    return 'N/A'
})

const farmTotalMPs = computed(() => {
    if (props.isOverview || !props.item) return 0
    const f = props.item
    const total = (f.fragment_count || 0) + (f.foam_count || 0) + (f.film_count || 0) +
        (f.fiber_count || 0) + (f.beads_count || 0) + (f.sheets_count || 0)
    return total > 0 ? total : (f.total_count || 0)
})

// --- 3. API & LOGIC ---

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

async function generateReport() {
    if (regionalReport.value?.id) previousReportId.value = regionalReport.value.id
    isGenerating.value = true
    try {
        await directus.request(customEndpoint({
            path: '/flows/trigger/914be7b3-e277-4de5-baa5-1724a964521b',
            method: 'POST',
            body: JSON.stringify(props.isOverview ? {} : { site_id: props.item?.id })
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
    if (props.isOverview) {
        pollInterval = setInterval(() => { fetchRegionalReport() }, 5000)
    } else {
        setTimeout(() => { isGenerating.value = false; emit('generated') }, 4000)
    }
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
        <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center">
                <VIcon color="primary" class="mr-2">mdi-brain</VIcon>
                <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">{{ props.title }}</h4>
            </div>
            <div v-if="isGenerating" class="d-flex align-center">
                <VProgressCircular indeterminate color="primary" size="16" width="2" class="mr-2" />
                <span class="text-caption text-primary font-weight-bold">Analyzing...</span>
            </div>
        </div>

        <div v-if="isGenerating && !formattedSummary"
            class="summary-card d-flex flex-column align-center justify-center py-8">
            <VIcon color="grey-lighten-1" size="large" class="mb-2">mdi-creation</VIcon>
            <p class="text-body-2 text-grey-darken-1 mb-0">Generating Smart Report...</p>
            <p class="text-caption text-grey">Analyzing soil morphometrics</p>
        </div>

        <div v-else-if="formattedSummary" class="summary-card">

            <div class="d-flex justify-space-between align-center mb-3">
                <div class="d-flex align-center">
                    <VIcon size="small" color="grey-darken-1" class="mr-1">mdi-calendar-check</VIcon>
                    <span class="text-caption text-grey-darken-2 font-weight-medium">
                        {{ summaryDateLabel }}
                    </span>
                </div>
                <div class="d-flex align-center">
                    <VChip v-if="props.isOverview && regionalReport" size="x-small" color="red" variant="flat"
                        class="font-weight-bold">
                        {{ regionalReport.total_pollution_count }} MPs Total
                    </VChip>
                    <VChip v-else-if="!props.isOverview && farmTotalMPs > 0" size="x-small" color="orange-darken-1"
                        variant="flat" class="font-weight-bold">
                        {{ farmTotalMPs }} MPs Found
                    </VChip>
                </div>
            </div>

            <div class="preview-container" @click="showReportDialog = true" style="cursor: pointer;">
                <div class="report-content" v-html="formattedSummary"></div>
                <div class="preview-fade"></div>
            </div>

            <div class="d-flex align-center mt-3 pt-3 border-t">
                <VBtn color="primary" variant="flat" size="small" @click="showReportDialog = true"
                    prepend-icon="mdi-book-open-variant">
                    Read Full Report
                </VBtn>
                <VSpacer></VSpacer>

                <VBtn v-if="props.isOverview" color="primary" variant="text" size="small" :loading="isGenerating"
                    :disabled="isGenerating" @click="generateReport" prepend-icon="mdi-refresh">
                    Regenerate
                </VBtn>
            </div>
        </div>

        <div v-else class="summary-card d-flex flex-column align-center justify-center py-6">
            <p class="text-body-2 text-grey mb-3">No analysis available.</p>
            <VBtn v-if="showGenerate" color="primary" variant="tonal" size="small" prepend-icon="mdi-creation"
                @click="generateReport">
                Generate Analysis
            </VBtn>
        </div>

        <VDialog v-model="showReportDialog" max-width="850" scrollable>
            <VCard>
                <VCardTitle class="d-flex justify-space-between align-center pa-4 bg-grey-lighten-4">
                    <div class="d-flex align-center">
                        <VIcon color="primary" class="mr-2">mdi-google-analytics</VIcon>
                        <span class="text-h6 font-weight-bold">
                            {{ props.isOverview ? 'Regional Intelligence Report' : 'Site Diagnostic Report' }}
                        </span>
                    </div>
                    <VBtn icon="mdi-close" variant="text" @click="showReportDialog = false"></VBtn>
                </VCardTitle>
                <VDivider></VDivider>

                <VCardText class="pa-6" style="min-height: 400px;">
                    <div class="text-body-1">

                        <div class="stats-grid mb-6">
                            <div class="stat-card bg-blue-lighten-5">
                                <div class="d-flex align-center text-primary mb-1">
                                    <VIcon size="small" class="mr-1">mdi-calendar-clock</VIcon>
                                    <span class="text-caption font-weight-bold text-uppercase">Date</span>
                                </div>
                                <div class="text-h6 font-weight-bold text-primary">
                                    {{ summaryDateLabel }}
                                </div>
                            </div>
                            <div class="stat-card bg-grey-lighten-4">
                                <div class="d-flex align-center text-grey-darken-2 mb-1">
                                    <VIcon size="small" class="mr-1">{{ isOverview ? 'mdi-map' : 'mdi-flower-tulip' }}
                                    </VIcon>
                                    <span class="text-caption font-weight-bold text-uppercase">Scope</span>
                                </div>
                                <div class="text-h6 font-weight-bold text-grey-darken-3">
                                    {{ isOverview ? (regionalReport?.total_farms_analyzed + ' Farms') : 'Single Site' }}
                                </div>
                            </div>
                            <div class="stat-card bg-red-lighten-5">
                                <div class="d-flex align-center text-red-darken-2 mb-1">
                                    <VIcon size="small" class="mr-1">mdi-alert-circle-outline</VIcon>
                                    <span class="text-caption font-weight-bold text-uppercase">Load</span>
                                </div>
                                <div class="text-h6 font-weight-bold text-red-darken-3">
                                    {{ isOverview ? regionalReport?.total_pollution_count : farmTotalMPs }} MPs
                                </div>
                            </div>
                        </div>

                        <div class="report-content" v-html="formattedSummary"></div>
                    </div>
                </VCardText>

                <VDivider></VDivider>
                <VCardActions class="pa-4 bg-grey-lighten-5">
                    <VSpacer></VSpacer>

                    <VBtn v-if="props.isOverview" color="primary" variant="outlined" :loading="isGenerating"
                        :disabled="isGenerating" @click="generateReport" prepend-icon="mdi-refresh">Regenerate</VBtn>

                    <VBtn color="primary" variant="elevated" @click="showReportDialog = false">Close</VBtn>
                </VCardActions>
            </VCard>
        </VDialog>
    </div>
</template>

<style scoped>
.summary-card {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.2s ease;
}

.summary-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.border-t {
    border-top: 1px solid #f0f0f0;
}

.preview-container {
    position: relative;
    max-height: 140px;
    overflow: hidden;
}

.preview-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1));
    pointer-events: none;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

@media (max-width: 600px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
}

.stat-card {
    border-radius: 8px;
    padding: 12px 16px;
    border: 1px solid rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.report-content :deep(h3) {
    font-size: 1.1rem;
    font-weight: 700;
    margin-top: 1.2em;
    margin-bottom: 0.5em;
    color: #1a1a1a;
    line-height: 1.3;
}

.report-content :deep(ul) {
    padding-left: 1.2em;
    margin-bottom: 0.8em;
}

.report-content :deep(li) {
    margin-bottom: 0.4em;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #424242;
}

.report-content :deep(strong),
.report-content :deep(b) {
    color: #000;
    font-weight: 600;
}

.report-content :deep(a) {
    color: #366ECE;
    text-decoration: none;
    font-weight: 500;
}

.report-content :deep(a):hover {
    text-decoration: underline;
}
</style>