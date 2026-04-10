import { readItems } from '@directus/sdk'
import { ref } from 'vue'
import directus from '@/composables/useDirectus.js'
import { useMicroplasticsStore } from '@/stores/microplastics.js'

export function useInsightData () {
  const sites = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadSites () {
    loading.value = true
    error.value = null
    try {
      const resp = await directus.request(
        readItems('sites', { fields: ['*', { soilsamples: ['*'] }], limit: -1 }),
      )
      sites.value = Array.isArray(resp) ? resp : (resp?.data || [])
    } catch (error_) {
      error.value = error_
      console.error('Failed to load sites from Directus', error_)
    } finally {
      loading.value = false
    }
  }

  async function loadAll () {
    await loadSites()
    useMicroplasticsStore().fetch() // fire-and-forget — store guards against duplicate calls
  }

  return { sites, loading, error, loadAll }
}
