import { computed } from 'vue'
import { calculateTotalMP, sanitizeSiteName } from '@/utils/microplasticsHelper.js'

export function useInsightKPIs (sites, colorData) {
  const microplasticTotals = computed(() => ({
    fragments: sites.value.reduce((s, r) => s + (Number(r.fragment_count) || 0), 0),
    fibers: sites.value.reduce((s, r) => s + (Number(r.fiber_count) || 0), 0),
    foams: sites.value.reduce((s, r) => s + (Number(r.foam_count) || 0), 0),
    films: sites.value.reduce((s, r) => s + (Number(r.film_count) || 0), 0),
    sheets: sites.value.reduce((s, r) => s + (Number(r.sheets_count) || Number(r.sheet_count) || Number(r.sheets) || 0), 0),
  }))

  const avgContaminationDensity = computed(() => {
    if (sites.value.length === 0) {
      return '0'
    }
    const densities = sites.value.map(s => {
      const totalMP = calculateTotalMP(s)
      const totalMassKg = (Array.isArray(s.soilsamples) ? s.soilsamples : [])
        .reduce((sum, sample) => sum + (Number(sample.mass_kg) || 0), 0)
      return totalMassKg > 0 ? totalMP / totalMassKg : 0
    })
    return (densities.reduce((a, b) => a + b, 0) / sites.value.length).toFixed(2)
  })

  const dominantPollutant = computed(() => {
    const t = microplasticTotals.value
    const morphologies = {
      fragments: t.fragments, fibers: t.fibers, foams: t.foams, films: t.films, sheets: t.sheets,
    }
    const dominantShape = Object.entries(morphologies).reduce((a, b) => b[1] > a[1] ? b : a)[0]

    if (colorData?.value?.drilldown?.length) {
      const shapeIdx = { fragments: 0, fibers: 1, foams: 2, films: 3, sheets: 4 }[dominantShape] ?? -1
      if (shapeIdx >= 0) {
        let maxCount = 0
        let mostCommonColor = ''
        for (let i = 0; i < colorData.value.drilldown.length; i++) {
          const count = colorData.value.drilldown[i][shapeIdx] || 0
          if (count > maxCount) {
            maxCount = count; mostCommonColor = colorData.value.categories[i]
          }
        }
        if (mostCommonColor) {
          return `${mostCommonColor} ${dominantShape}`
        }
      }
    }
    return dominantShape.charAt(0).toUpperCase() + dominantShape.slice(1)
  })

  const highestRiskSite = computed(() => {
    if (sites.value.length === 0) {
      return { name: 'N/A', density: '0' }
    }
    return sites.value
      .map(s => ({ name: sanitizeSiteName(s.site_name), density: calculateTotalMP(s) }))
      .reduce((a, b) => b.density > a.density ? b : a)
  })

  return { microplasticTotals, avgContaminationDensity, dominantPollutant, highestRiskSite }
}
