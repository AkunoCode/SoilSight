import { readItems } from '@directus/sdk'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import directus from '@/composables/useDirectus.js'
import { MP_SIZE_BUCKETS } from '@/config/constants.js'
import { areaToDiameter, morphologyIndex, toNumber } from '@/utils/microplasticsHelper.js'

export const useMicroplasticsStore = defineStore('microplastics', () => {
  const rawItems = ref([])
  const loading = ref(false)
  const error = ref(null)
  const selectedSizeField = ref('equivalent_circular_diameter_um')

  async function fetch () {
    if (rawItems.value.length) return
    loading.value = true
    try {
      const resp = await directus.request(readItems('microplastics', { limit: -1 }))
      rawItems.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (err) {
      error.value = err
      console.error('useMicroplasticsStore: fetch failed', err)
    } finally {
      loading.value = false
    }
  }

  const colorData = computed(() => {
    const items = rawItems.value
    if (items.length === 0) {
      return { categories: [], totals: [], drilldown: [], overviewColors: [] }
    }
    const counts = new Map()
    const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\\s]/g, '') || 'unknown'
    for (const it of items) {
      const rawColor = it.color || 'unknown'
      const norm = normKey(rawColor)
      if (!counts.has(norm)) {
        counts.set(norm, { count: 0, display: rawColor, drilldown: [0, 0, 0, 0, 0] })
      }
      const obj = counts.get(norm)
      const amount = Number(it.count || 1)
      obj.count += amount
      const midx = morphologyIndex(it.shape)
      if (midx >= 0) obj.drilldown[midx] += amount
    }
    const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 12)
    return {
      categories: arr.map(x => x.display),
      totals: arr.map(x => x.count),
      drilldown: arr.map(x => x.drilldown),
      overviewColors: arr.map((_, i) => `hsl(${220 - i * 20}, 60%, 45%)`),
    }
  })

  const sizeData = computed(() => {
    const items = rawItems.value
    const fieldKey = selectedSizeField.value
    const buckets = MP_SIZE_BUCKETS
    const totals = Array.from({ length: buckets.length }).fill(0)
    const drilldown = Array.from({ length: buckets.length }).fill(0).map(() => [0, 0, 0, 0, 0])
    for (const it of items) {
      const amount = Number(it.count || 1)
      let val = toNumber(it[fieldKey])
      if (Number.isNaN(val) && it.size > 0) {
        const s = it.size.toLowerCase()
        const num = Number.parseFloat(s)
        if (!Number.isNaN(num)) val = s.includes('mm') ? num * 1000 : num
      }
      if (fieldKey === 'area_um2' && Number.isFinite(val)) val = areaToDiameter(val)
      let bIdx = -1
      if (Number.isFinite(val)) {
        for (const [i, bucket] of buckets.entries()) {
          if (val >= bucket.min && val < bucket.max) { bIdx = i; break }
        }
      }
      const midx = morphologyIndex(it.shape)
      if (bIdx >= 0) {
        totals[bIdx] += amount
        if (midx >= 0) drilldown[bIdx][midx] += amount
      }
    }
    return {
      categories: buckets.map(b => b.label),
      totals,
      drilldown,
      overviewColors: buckets.map(() => '#366ECE'),
    }
  })

  return { rawItems, loading, error, selectedSizeField, fetch, colorData, sizeData }
})
