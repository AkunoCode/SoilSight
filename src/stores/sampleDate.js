import { readItems } from '@directus/sdk'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import directus from '@/composables/useDirectus.js'

export const useSampleDateStore = defineStore('sampleDate', () => {
  const latestSampleDate = ref(null)
  const loading = ref(false)
  const fetched = ref(false)

  async function fetch () {
    if (fetched.value) return
    loading.value = true
    try {
      const resp = await directus.request(readItems('soilsamples', { sort: ['-date_collected'], limit: 1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      latestSampleDate.value = items[0]?.date_collected ?? null
      fetched.value = true
    } catch (error) {
      console.warn('useSampleDateStore: failed to fetch latest soilsample date', error)
      latestSampleDate.value = null
    } finally {
      loading.value = false
    }
  }

  const displayLatestSampleDate = computed(() => {
    const d = latestSampleDate.value
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!d) return currentDate
    try {
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return currentDate
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return currentDate
    }
  })

  return { latestSampleDate, loading, fetched, fetch, displayLatestSampleDate }
})
