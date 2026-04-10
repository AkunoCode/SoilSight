import { ref } from 'vue'
import directus from '@/composables/useDirectus.js'
import { readItems } from '@directus/sdk'
import { morphologyIndex, toNumber, areaToDiameter } from '@/utils/microplasticsHelper.js'
import { MP_SIZE_BUCKETS } from '@/config/constants.js'

export function useInsightData() {
  const sites        = ref([])
  const loading      = ref(false)
  const error        = ref(null)
  const colorData    = ref(null)
  const colorLoading = ref(false)
  const sizeData     = ref(null)
  const selectedSizeField = ref('equivalent_circular_diameter_um')

  async function loadSites() {
    loading.value = true
    error.value   = null
    try {
      const resp = await directus.request(
        readItems('sites', { fields: ['*', { soilsamples: ['*'] }], limit: -1 })
      )
      sites.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (err) {
      error.value = err
      console.error('Failed to load sites from Directus', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchColorData() {
    colorLoading.value = true
    try {
      const resp  = await directus.request(readItems('microplastics', { limit: -1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      if (!items.length) {
        colorData.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
        return
      }
      const counts  = new Map()
      const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'
      for (const it of items) {
        const rawColor = it.color || 'unknown'
        const norm     = normKey(rawColor)
        if (!counts.has(norm)) counts.set(norm, { count: 0, display: rawColor, drilldown: [0, 0, 0, 0, 0] })
        const obj    = counts.get(norm)
        const amount = Number(it.count || 1)
        obj.count   += amount
        const midx   = morphologyIndex(it.shape)
        if (midx >= 0) obj.drilldown[midx] += amount
      }
      const arr = Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 12)
      colorData.value = {
        categories:    arr.map(x => x.display),
        totals:        arr.map(x => x.count),
        drilldown:     arr.map(x => x.drilldown),
        overviewColors: arr.map((_, i) => `hsl(${220 - i * 20}, 60%, 45%)`),
      }
    } catch (e) {
      console.error('Color fetch error', e)
    } finally {
      colorLoading.value = false
    }
  }

  async function fetchSizeData(fieldKey = 'equivalent_circular_diameter_um') {
    try {
      const resp  = await directus.request(readItems('microplastics', { limit: -1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      if (!items.length) {
        sizeData.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
        return
      }
      const buckets = MP_SIZE_BUCKETS
      const totals   = new Array(buckets.length).fill(0)
      const drilldown = new Array(buckets.length).fill(0).map(() => [0, 0, 0, 0, 0])
      for (const it of items) {
        const amount = Number(it.count || 1)
        let val = toNumber(it[fieldKey])
        if (Number.isNaN(val) && it.size) {
          const s   = it.size.toLowerCase()
          const num = parseFloat(s)
          if (!Number.isNaN(num)) val = s.includes('mm') ? num * 1000 : num
        }
        if (fieldKey === 'area_um2' && Number.isFinite(val)) val = areaToDiameter(val)
        let bIdx = -1
        if (Number.isFinite(val)) {
          for (let i = 0; i < buckets.length; i++) {
            if (val >= buckets[i].min && val < buckets[i].max) { bIdx = i; break }
          }
        }
        const midx = morphologyIndex(it.shape)
        if (bIdx >= 0) {
          totals[bIdx] += amount
          if (midx >= 0) drilldown[bIdx][midx] += amount
        }
      }
      sizeData.value = {
        categories:    buckets.map(b => b.label),
        totals,
        drilldown,
        overviewColors: buckets.map(() => '#366ECE'),
      }
    } catch (e) {
      console.error('Size fetch error', e)
      sizeData.value = null
    }
  }

  async function loadAll() {
    await loadSites()
    await Promise.allSettled([
      fetchColorData(),
      fetchSizeData(selectedSizeField.value),
    ])
  }

  return {
    sites, loading, error,
    colorData, colorLoading,
    sizeData, selectedSizeField,
    loadAll, fetchSizeData,
  }
}
