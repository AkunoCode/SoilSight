import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import directus from '@/composables/useDirectus.js'
import { useSampleDateStore } from './sampleDate.js'

vi.mock('@/composables/useDirectus.js', () => ({
  default: { request: vi.fn() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useSampleDateStore', () => {
  describe('initial state', () => {
    it('starts with null latestSampleDate', () => {
      const store = useSampleDateStore()
      expect(store.latestSampleDate).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('fetch()', () => {
    it('sets latestSampleDate from API response', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBe('2025-03-15')
    })

    it('only fetches once — second call is a no-op', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      await store.fetch()
      expect(directus.request).toHaveBeenCalledTimes(1)
    })

    it('leaves latestSampleDate null on empty response', async () => {
      directus.request.mockResolvedValue([])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBeNull()
    })

    it('handles { data: [...] } response shape', async () => {
      directus.request.mockResolvedValue({ data: [{ date_collected: '2025-06-01' }] })
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.latestSampleDate).toBe('2025-06-01')
    })
  })

  describe('displayLatestSampleDate computed', () => {
    it('formats a valid ISO date string as human-readable', async () => {
      directus.request.mockResolvedValue([{ date_collected: '2025-03-15' }])
      const store = useSampleDateStore()
      await store.fetch()
      expect(store.displayLatestSampleDate).toMatch(/March/)
      expect(store.displayLatestSampleDate).toMatch(/2025/)
    })

    it('falls back to a non-empty string when latestSampleDate is null', () => {
      const store = useSampleDateStore()
      expect(typeof store.displayLatestSampleDate).toBe('string')
      expect(store.displayLatestSampleDate.length).toBeGreaterThan(0)
    })
  })
})
