import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import directus from '@/composables/useDirectus.js'
import { useMicroplasticsStore } from './microplastics.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

const MOCK_ITEMS = [
  { color: 'Black', shape: 'Fragment', count: 3, equivalent_circular_diameter_um: 200 },
  { color: 'White', shape: 'Fiber', count: 2, equivalent_circular_diameter_um: 2000 },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useMicroplasticsStore', () => {
  describe('initial state', () => {
    it('starts with empty rawItems', () => {
      const store = useMicroplasticsStore()
      expect(store.rawItems).toEqual([])
      expect(store.loading).toBe(false)
    })
  })

  describe('fetch()', () => {
    it('populates rawItems on success', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.rawItems).toHaveLength(2)
    })

    it('only fetches once — second call is a no-op', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      await store.fetch()
      expect(directus.request).toHaveBeenCalledTimes(1)
    })

    it('handles { data: [...] } response shape', async () => {
      directus.request.mockResolvedValue({ data: MOCK_ITEMS })
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.rawItems).toHaveLength(2)
    })

    it('sets error on failure and leaves rawItems empty', async () => {
      directus.request.mockRejectedValue(new Error('403 Forbidden'))
      const store = useMicroplasticsStore()
      await store.fetch()
      expect(store.error).toBeTruthy()
      expect(store.rawItems).toEqual([])
    })
  })

  describe('colorData computed', () => {
    it('returns empty shape when rawItems is empty', () => {
      const store = useMicroplasticsStore()
      expect(store.colorData).toEqual({
        categories: [], totals: [], drilldown: [], overviewColors: [],
      })
    })

    it('groups items by color and totals their count', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      const blackIdx = store.colorData.categories.indexOf('Black')
      expect(blackIdx).toBeGreaterThanOrEqual(0)
      expect(store.colorData.totals[blackIdx]).toBe(3)
    })
  })

  describe('sizeData computed', () => {
    it('returns zeroed bucket totals when rawItems is empty', () => {
      const store = useMicroplasticsStore()
      expect(store.sizeData.categories.length).toBeGreaterThan(0)
      expect(store.sizeData.totals.every(n => n === 0)).toBe(true)
    })

    it('buckets items by equivalent_circular_diameter_um', async () => {
      directus.request.mockResolvedValue(MOCK_ITEMS)
      const store = useMicroplasticsStore()
      await store.fetch()
      const total = store.sizeData.totals.reduce((a, b) => a + b, 0)
      expect(total).toBe(5) // count: 3 + count: 2
    })

    it('falls back to size field when primary field is NaN', async () => {
      const itemsWithSizeFallback = [
        { color: 'Red', shape: 'Fragment', count: 1, equivalent_circular_diameter_um: null, size: '500' },
      ]
      directus.request.mockResolvedValue(itemsWithSizeFallback)
      const store = useMicroplasticsStore()
      await store.fetch()
      // Item has NaN primary field but numeric size; should fall back and be bucketed
      const total = store.sizeData.totals.reduce((a, b) => a + b, 0)
      expect(total).toBeGreaterThan(0) // At least one item should be bucketed via fallback
    })
  })
})
