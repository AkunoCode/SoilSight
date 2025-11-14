import { ref, computed } from 'vue'
import directus from '@/composables/useDirectus'
import { readItems } from '@directus/sdk'

export default function useLatestSampleDate() {
  const latestSampleDate = ref(null)
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  async function fetchLatestSampleDate() {
    try {
      const resp = await directus.request(readItems('soilsamples', { sort: ['-date_collected'], limit: 1 }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])
      latestSampleDate.value = (items && items[0] && items[0].date_collected) || null
    } catch (err) {
      console.warn('useLatestSampleDate: failed to fetch latest soilsample date', err)
      latestSampleDate.value = null
    }
    return latestSampleDate.value
  }

  const displayLatestSampleDate = computed(() => {
    const d = latestSampleDate.value
    if (!d) return currentDate
    try {
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return currentDate
      return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return currentDate
    }
  })

  // fetch immediately (best-effort). Consumers can also call fetchLatestSampleDate()
  void fetchLatestSampleDate()

  return { latestSampleDate, displayLatestSampleDate, fetchLatestSampleDate }
}
