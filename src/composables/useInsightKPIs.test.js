import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useInsightKPIs } from './useInsightKPIs.js'

// Factory for a minimal site object
const makeSite = (overrides = {}) => ({
  fragment_count: 10,
  fiber_count: 5,
  foam_count: 2,
  film_count: 3,
  sheets_count: 1,
  soilsamples: [{ mass_kg: 1 }],
  site_name: 'Test Farm',
  cultivation_practice: 'conventional',
  ...overrides,
})

describe('useInsightKPIs', () => {
  describe('microplasticTotals', () => {
    it('sums counts across all sites', () => {
      const sites = ref([makeSite(), makeSite()])
      const { microplasticTotals } = useInsightKPIs(sites, ref(null))
      expect(microplasticTotals.value.fragments).toBe(20)
      expect(microplasticTotals.value.fibers).toBe(10)
      expect(microplasticTotals.value.foams).toBe(4)
      expect(microplasticTotals.value.films).toBe(6)
      expect(microplasticTotals.value.sheets).toBe(2)
    })
    it('returns zero totals for empty sites', () => {
      const { microplasticTotals } = useInsightKPIs(ref([]), ref(null))
      expect(microplasticTotals.value.fragments).toBe(0)
    })
  })

  describe('avgContaminationDensity', () => {
    it('returns "0" when no sites', () => {
      const { avgContaminationDensity } = useInsightKPIs(ref([]), ref(null))
      expect(avgContaminationDensity.value).toBe('0')
    })
    it('calculates MP per kg averaged across sites', () => {
      // totalMP=21, mass_kg=1 → density=21.00
      const site = makeSite({
        fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1,
        soilsamples: [{ mass_kg: 1 }],
      })
      const { avgContaminationDensity } = useInsightKPIs(ref([site]), ref(null))
      expect(avgContaminationDensity.value).toBe('21.00')
    })
    it('returns 0.00 density when site has no mass', () => {
      const site = makeSite({ soilsamples: [] })
      const { avgContaminationDensity } = useInsightKPIs(ref([site]), ref(null))
      expect(avgContaminationDensity.value).toBe('0.00')
    })
  })

  describe('highestRiskSite', () => {
    it('returns N/A when no sites', () => {
      const { highestRiskSite } = useInsightKPIs(ref([]), ref(null))
      expect(highestRiskSite.value.name).toBe('N/A')
    })
    it('returns site with highest total MP', () => {
      const low = makeSite({ fragment_count: 1, fiber_count: 0, foam_count: 0, film_count: 0, sheets_count: 0, site_name: 'Low Farm' })
      const high = makeSite({ fragment_count: 100, fiber_count: 0, foam_count: 0, film_count: 0, sheets_count: 0, site_name: 'High Farm' })
      const { highestRiskSite } = useInsightKPIs(ref([low, high]), ref(null))
      // sanitizeSiteName removes "Farm"
      expect(highestRiskSite.value.name).toBe('High')
      expect(highestRiskSite.value.density).toBe(100)
    })
  })

  describe('dominantPollutant', () => {
    it('returns the shape with the highest count', () => {
      const site = makeSite({ fragment_count: 100, fiber_count: 1, foam_count: 1, film_count: 1, sheets_count: 1 })
      const { dominantPollutant } = useInsightKPIs(ref([site]), ref(null))
      expect(dominantPollutant.value).toBe('Fragments')
    })
    it('includes color prefix when colorData is available', () => {
      const site = makeSite({ fragment_count: 100, fiber_count: 1, foam_count: 1, film_count: 1, sheets_count: 1 })
      // colorData: one category "Black" with drilldown[0]=50 (fragments index)
      const colorData = ref({
        categories: ['Black'],
        drilldown: [[50, 0, 0, 0, 0]],
      })
      const { dominantPollutant } = useInsightKPIs(ref([site]), colorData)
      expect(dominantPollutant.value).toBe('Black fragments')
    })
  })
})
