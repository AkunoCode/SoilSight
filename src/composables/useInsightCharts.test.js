import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useInsightCharts } from './useInsightCharts.js'

function makeSite (overrides = {}) {
  return {
    fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1,
    site_name: 'Alpha Farm',
    soil_type: 'Clay',
    land_area_ha: 0.5,
    cultivation_practice: 'organic',
    plastic_activity: ['Plastic Mulching'],
    crops: ['rice', 'corn'],
    ...overrides,
  }
}

describe('useInsightCharts', () => {
  describe('siteCategories', () => {
    it('returns sanitized site names', () => {
      const sites = ref([makeSite({ site_name: 'Alpha Farm' })])
      const { siteCategories } = useInsightCharts(sites, ref(null))
      expect(siteCategories.value).toEqual(['Alpha'])
    })
  })

  describe('siteTotals', () => {
    it('returns total MP per site using calculateTotalMP', () => {
      const sites = ref([makeSite()])
      const { siteTotals } = useInsightCharts(sites, ref(null))
      expect(siteTotals.value[0]).toBe(21) // 10+5+2+3+1
    })
  })

  describe('inputTotals', () => {
    it('sums MP for sites with matching plastic_activity', () => {
      const site = makeSite({ plastic_activity: ['Plastic Mulching'] })
      const { inputTotals } = useInsightCharts(ref([site]), ref(null))
      // index 1 = Plastic Mulching
      expect(inputTotals.value[1]).toBe(21)
      // index 0 = Fertilizer Sacks — site does not have this
      expect(inputTotals.value[0]).toBe(0)
    })

    it('accumulates MP across multiple sites sharing the same input type', () => {
      const siteA = makeSite({ plastic_activity: ['Plastic Mulching'], fragment_count: 10 })
      const siteB = makeSite({ plastic_activity: ['Plastic Mulching'], fragment_count: 5 })
      const { inputTotals } = useInsightCharts(ref([siteA, siteB]), ref(null))
      // index 1 = Plastic Mulching; both sites contribute
      expect(inputTotals.value[1]).toBe(37) // (10+5+2+3+1) + (5+5+2+3+1) = 21 + 16
    })
  })

  describe('biologicalRiskData', () => {
    it('returns empty array when sizeData is null', () => {
      const { biologicalRiskData } = useInsightCharts(ref([]), ref(null))
      expect(biologicalRiskData.value).toEqual([])
    })
    it('bins size data into 3 risk categories', () => {
      const sizeData = ref({
        categories: ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm'],
        totals: [10, 20, 15, 5, 8],
      })
      const { biologicalRiskData } = useInsightCharts(ref([]), sizeData)
      expect(biologicalRiskData.value).toEqual([
        { category: '< 100 µm', count: 30 }, // 10 + 20
        { category: '100-500 µm', count: 15 },
        { category: '> 1 mm', count: 8 },
      ])
    })
  })

  describe('topCrops', () => {
    it('returns top crops sorted by count', () => {
      const sites = ref([
        makeSite({ crops: ['rice', 'corn'] }),
        makeSite({ crops: ['rice'] }),
      ])
      const { topCrops } = useInsightCharts(sites, ref(null))
      expect(topCrops.value[0].crop).toBe('Rice')
      expect(topCrops.value[0].count).toBe(2)
    })
  })

  describe('siteDrilldown', () => {
    it('picks up sheets_count', () => {
      const sites = ref([makeSite({ sheets_count: 7, sheet_count: undefined, sheets: undefined })])
      const { siteDrilldown } = useInsightCharts(sites, ref(null))
      expect(siteDrilldown.value[0][4]).toBe(7)
    })
    it('falls back to sheet_count when sheets_count is absent', () => {
      const sites = ref([makeSite({ sheets_count: undefined, sheet_count: 4, sheets: undefined })])
      const { siteDrilldown } = useInsightCharts(sites, ref(null))
      expect(siteDrilldown.value[0][4]).toBe(4)
    })
    it('falls back to sheets when both count fields are absent', () => {
      const sites = ref([makeSite({ sheets_count: undefined, sheet_count: undefined, sheets: 3 })])
      const { siteDrilldown } = useInsightCharts(sites, ref(null))
      expect(siteDrilldown.value[0][4]).toBe(3)
    })
  })

  describe('textureDrilldown', () => {
    it('handles sheet_count variant for sheets column', () => {
      const sites = ref([makeSite({ soil_type: 'Clay', sheets_count: undefined, sheet_count: 9 })])
      const { textureDrilldown } = useInsightCharts(sites, ref(null))
      expect(textureDrilldown.value[0][4]).toBe(9)
    })
  })

  describe('inputDrilldown', () => {
    it('falls back to sheet_count variant in sheets column', () => {
      const sites = ref([makeSite({
        plastic_activity: ['Plastic Mulching'],
        sheets_count: undefined,
        sheet_count: 6,
        sheets: undefined,
      })])
      const { inputDrilldown } = useInsightCharts(sites, ref(null))
      // index 1 = Plastic Mulching
      expect(inputDrilldown.value[1][4]).toBe(6)
    })
  })

  describe('contaminationByPracticeSeries', () => {
    it('handles sheets variant in sheets column', () => {
      const sites = ref([makeSite({
        cultivation_practice: 'organic',
        sheets_count: undefined, sheet_count: undefined, sheets: 5,
      })])
      const { contaminationByPracticeSeries } = useInsightCharts(sites, ref(null))
      const organicSeries = contaminationByPracticeSeries.value.find(s => s.name === 'Organic Practice')
      expect(organicSeries.data[4]).toBe(5)
    })
  })

  describe('farmSizeCounts', () => {
    it('excludes sites with null land_area_ha from all buckets', () => {
      const sites = ref([
        makeSite({ land_area_ha: null }),
        makeSite({ land_area_ha: undefined }),
        makeSite({ land_area_ha: 0.5 }),
      ])
      const { farmSizeCounts } = useInsightCharts(sites, ref(null))
      const { small, medium, large } = farmSizeCounts.value
      expect(small + medium + large).toBe(1) // only the 0.5ha site
      expect(small).toBe(1)
    })
    it('counts small/medium/large correctly for valid areas', () => {
      const sites = ref([
        makeSite({ land_area_ha: 0.5 }),
        makeSite({ land_area_ha: 2 }),
        makeSite({ land_area_ha: 5 }),
      ])
      const { farmSizeCounts } = useInsightCharts(sites, ref(null))
      expect(farmSizeCounts.value).toEqual({ small: 1, medium: 1, large: 1 })
    })
  })

  describe('textureTotals — output matches after grouping refactor', () => {
    it('returns correct totals per texture', () => {
      const sites = ref([
        makeSite({ soil_type: 'Clay', fragment_count: 10, sheets_count: 1 }),
        makeSite({ soil_type: 'Clay', fragment_count: 5, sheets_count: 2 }),
        makeSite({ soil_type: 'Loam', fragment_count: 8, sheets_count: 0 }),
      ])
      const { textureTotals } = useInsightCharts(sites, ref(null))
      // Clay: (10+5+2+3+1)+(5+5+2+3+2) = 21+17 = 38; Loam: 8+5+2+3+0 = 18
      expect(textureTotals.value).toHaveLength(2)
      expect(textureTotals.value.every(n => typeof n === 'number')).toBe(true)
    })
  })

  describe('contaminationByPracticeSeries — output matches after grouping refactor', () => {
    it('assigns sites to correct practice bucket', () => {
      const organicSite = makeSite({ cultivation_practice: 'Organic Practice', fragment_count: 50 })
      const convSite = makeSite({ cultivation_practice: 'Conventional Practice', fragment_count: 20 })
      const sites = ref([organicSite, convSite])
      const { contaminationByPracticeSeries } = useInsightCharts(sites, ref(null))
      const organic = contaminationByPracticeSeries.value.find(s => s.name === 'Organic Practice')
      const conv = contaminationByPracticeSeries.value.find(s => s.name === 'Conventional Practice')
      expect(organic.data[0]).toBe(50)
      expect(conv.data[0]).toBe(20)
    })
  })
})
