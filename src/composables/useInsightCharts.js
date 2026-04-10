import { computed } from 'vue'
import { calculateTotalMP, sanitizeSiteName, siteHasActivity } from '@/utils/microplasticsHelper.js'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import { CHART_COLORS } from '@/config/chartPalette.js'

const INPUT_TYPES = [
  'Fertilizer Sacks',
  'Plastic Mulching',
  'Seedling Trays',
  'Compost with Plastic',
  'Greenhouse Plastic Sheet',
]
const PRACTICE_NAMES = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']
const PRACTICE_KEYS  = ['conventional', 'organic', 'integrated']

export function useInsightCharts(sites, sizeData) {
  const siteCategories = computed(() => sites.value.map(s => sanitizeSiteName(s.site_name)))

  const siteTotals = computed(() => sites.value.map(s => calculateTotalMP(s)))

  const siteDrilldown = computed(() => sites.value.map(s => [
    Number(s.fragment_count) || 0,
    Number(s.fiber_count)    || 0,
    Number(s.foam_count)     || 0,
    Number(s.film_count)     || 0,
    Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0,
  ]))

  const inputTotals = computed(() =>
    INPUT_TYPES.map(type =>
      sites.value.reduce((acc, s) => siteHasActivity(s, type) ? acc + calculateTotalMP(s) : acc, 0)
    )
  )

  const inputDrilldown = computed(() =>
    INPUT_TYPES.map(type =>
      sites.value.reduce((acc, s) => {
        if (!siteHasActivity(s, type)) return acc
        acc[0] += Number(s.fragment_count) || 0
        acc[1] += Number(s.fiber_count)    || 0
        acc[2] += Number(s.foam_count)     || 0
        acc[3] += Number(s.film_count)     || 0
        acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
        return acc
      }, [0, 0, 0, 0, 0])
    )
  )

  const textures = computed(() =>
    Array.from(new Set(sites.value.map(s => s.soil_type || 'Unknown')))
  )

  const textureTotals = computed(() =>
    textures.value.map(t =>
      sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => acc + calculateTotalMP(s), 0)
    )
  )

  const textureDrilldown = computed(() =>
    textures.value.map(t =>
      sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
        acc[0] += Number(s.fragment_count) || 0
        acc[1] += Number(s.fiber_count)    || 0
        acc[2] += Number(s.foam_count)     || 0
        acc[3] += Number(s.film_count)     || 0
        acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
        return acc
      }, [0, 0, 0, 0, 0])
    )
  )

  const contaminationByPracticeSeries = computed(() =>
    PRACTICE_NAMES.map((name, i) => {
      const key = PRACTICE_KEYS[i]
      const filtered = sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(key))
      return {
        name,
        data: [
          filtered.reduce((a, b) => a + (Number(b.fragment_count) || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.fiber_count)    || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.foam_count)     || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.film_count)     || 0), 0),
          filtered.reduce((a, b) => a + (Number(b.sheets_count) || Number(b.sheet_count) || Number(b.sheets) || 0), 0),
        ],
      }
    })
  )

  const contaminationByPracticeOptions = computed(() => {
    const allVals = contaminationByPracticeSeries.value.flatMap(s => s.data)
    const maxVal = allVals.length ? Math.max(...allVals) : 700
    return getDefaultBarOptions(['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets'], {
      chart: { type: 'bar' },
      legend: { position: 'bottom' },
      yaxis: { title: { text: 'Count' }, min: 0, max: Math.ceil(maxVal * 1.1) },
    })
  })

  const biologicalRiskData = computed(() => {
    const sizes = sizeData?.value
    if (!sizes?.categories?.length) return []
    const findTotal = label => {
      const idx = sizes.categories.findIndex(c => (c || '').toLowerCase() === label.toLowerCase())
      return idx >= 0 ? (sizes.totals[idx] || 0) : 0
    }
    return [
      { category: '< 100 µm',   count: findTotal('1-20 µm') + findTotal('20-100 µm') },
      { category: '100-500 µm', count: findTotal('100-500 µm') },
      { category: '> 1 mm',     count: findTotal('1-5 mm') },
    ]
  })

  const farmSizeCounts = computed(() => ({
    small:  sites.value.filter(s => s.land_area_ha < 1).length,
    medium: sites.value.filter(s => s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
    large:  sites.value.filter(s => s.land_area_ha > 3).length,
  }))

  const farmSizeSeries = computed(() => [{
    name: 'Farms',
    data: [farmSizeCounts.value.small, farmSizeCounts.value.medium, farmSizeCounts.value.large],
  }])

  const farmSizeOptions = computed(() => ({
    chart: { type: 'bar', toolbar: { show: false } },
    xaxis: { categories: ['Small (<1ha)', 'Medium (1-3ha)', 'Large (>3ha)'] },
    plotOptions: { bar: { horizontal: false, columnWidth: '70%' } },
    legend: { show: false },
    colors: [CHART_COLORS[2]],
  }))

  const topCrops = computed(() => {
    const counts = {}
    for (const s of sites.value) {
      let raw = s.crops
      if (!raw) continue
      if (typeof raw === 'string') raw = raw.split(/[;,|\n]/).map(x => x.trim())
      if (!Array.isArray(raw)) continue
      for (const item of raw) {
        const key = String(item).toLowerCase().trim()
        if (key) counts[key] = (counts[key] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => ({ crop: c.charAt(0).toUpperCase() + c.slice(1), count: n }))
  })

  return {
    siteCategories, siteTotals, siteDrilldown,
    inputTotals, inputDrilldown,
    textures, textureTotals, textureDrilldown,
    contaminationByPracticeSeries, contaminationByPracticeOptions,
    biologicalRiskData,
    farmSizeSeries, farmSizeOptions,
    topCrops,
  }
}
