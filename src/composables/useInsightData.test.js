import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import directus from '@/composables/useDirectus.js'
import { useInsightData } from './useInsightData.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

// useMicroplasticsStore is called inside loadAll; mock it to prevent a second directus.request call
vi.mock('@/stores/microplastics.js', () => ({
  useMicroplasticsStore: () => ({ fetch: vi.fn() }),
}))

const MOCK_SITES = [
  { id: 1, site_name: 'Alpha Farm', fragment_count: 10, soilsamples: [] },
  { id: 2, site_name: 'Beta Farm', fragment_count: 5, soilsamples: [] },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useInsightData', () => {
  describe('initial state', () => {
    it('starts with empty sites and no error', () => {
      const { sites, loading, error } = useInsightData()
      expect(sites.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBe(null)
    })
  })

  describe('loadAll', () => {
    it('populates sites after successful fetch', async () => {
      directus.request.mockResolvedValue(MOCK_SITES)
      const { sites, loadAll } = useInsightData()
      await loadAll()
      expect(sites.value).toHaveLength(2)
      expect(sites.value[0].site_name).toBe('Alpha Farm')
    })

    it('sets error when fetch fails', async () => {
      directus.request.mockRejectedValueOnce(new Error('403 Forbidden'))
      const { error, loadAll } = useInsightData()
      await loadAll()
      expect(error.value).toBeTruthy()
      expect(error.value.message).toBe('403 Forbidden')
    })

    it('handles SDK response wrapped in { data: [...] }', async () => {
      directus.request.mockResolvedValue({ data: MOCK_SITES })
      const { sites, loadAll } = useInsightData()
      await loadAll()
      expect(sites.value).toHaveLength(2)
    })
  })
})
