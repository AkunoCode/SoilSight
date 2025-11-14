<script setup>
/* eslint-disable unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument */
import { computed, onMounted, ref, watch } from 'vue'
import directus from '@/composables/useDirectus.js'
import { readItems } from '@directus/sdk'
import useLatestSampleDate from '@/composables/useLatestSampleDate.js'

import ApexChartBase from '@/components/graphs/ApexChartBase.vue'
import { getDefaultBarOptions } from '@/components/graphs/defaultBarOptions.js'
import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
import MPPracticeBar from '@/components/graphs/MPPracticeBar.vue'
import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'
import MPSizeRangeAll from '@/components/graphs/MPSizeRangeAll.vue'
import SampledFarms from '@/components/SampledFarms.vue'

// Sites will be loaded from Directus
const sites = ref([])
const loading = ref(false)
const error = ref(null)

const { displayLatestSampleDate, fetchLatestSampleDate } = useLatestSampleDate()

async function loadSites() {
  loading.value = true
  error.value = null
  try {
    const resp = await directus.request(readItems('sites', { fields: ['*'], limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    sites.value = items || []
  } catch (err) {
    error.value = err
    console.error('Failed to load sites from Directus', err)
  } finally {
    loading.value = false
  }
}

// Derived metrics computed reactively from `sites`
const totalFragments = computed(() => sites.value.reduce((s, r) => s + (Number(r.fragment_count) || 0), 0))
const totalFibers = computed(() => sites.value.reduce((s, r) => s + (Number(r.fiber_count) || 0), 0))
const totalFoams = computed(() => sites.value.reduce((s, r) => s + (Number(r.foam_count) || 0), 0))
const totalFilms = computed(() => sites.value.reduce((s, r) => s + (Number(r.film_count) || 0), 0))
const totalPellets = computed(() => sites.value.reduce((s, r) => s + (Number(r.beads_count) || 0), 0))
const totalSheets = computed(() => sites.value.reduce((s, r) => s + (Number(r.sheets_count) || Number(r.sheet_count) || Number(r.sheets) || 0), 0))

const compositionSeries = computed(() => [
  totalFragments.value,
  totalFibers.value,
  totalFoams.value,
  totalFilms.value,
  totalSheets.value,
  totalPellets.value,
])

// Richer composition data and interactive legend (reuse PreviewCard style)
const microplasticData = computed(() => ({
  fragments: totalFragments.value,
  fibers: totalFibers.value,
  foams: totalFoams.value,
  films: totalFilms.value,
  sheets: totalSheets.value,
  pellets: totalPellets.value,
}))

const totalMP = computed(() => Object.values(microplasticData.value).reduce((a, b) => a + b, 0))

const percentages = computed(() => {
  const t = totalMP.value
  return t === 0
    ? { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0, pellets: 0 }
    : {
      fragments: Math.round((microplasticData.value.fragments / t) * 100),
      fibers: Math.round((microplasticData.value.fibers / t) * 100),
      foams: Math.round((microplasticData.value.foams / t) * 100),
      films: Math.round((microplasticData.value.films / t) * 100),
      sheets: Math.round((microplasticData.value.sheets / t) * 100),
      pellets: Math.round((microplasticData.value.pellets / t) * 100),
    }
})

const mpColors = {
  fragments: '#0B2E4E',
  fibers: '#19568E',
  films: '#63B3FF',
  foams: '#4688C7',
  sheets: '#8AB4FF',
  pellets: '#B9DDFF',
}

const labelsMap = {
  fragments: 'Fragments',
  fibers: 'Fibers',
  foams: 'Foam',
  films: 'Films',
  sheets: 'Sheets',
  pellets: 'Pellets',
}

const selectedKey = ref(null)

const donutLabelsMap = {
  fragments: 'Fragments',
  fibers: 'Fibers',
  foams: 'Foam',
  films: 'Films',
  sheets: 'Sheets',
  pellets: 'Pellets',
}

const donutColors = {
  fragments: mpColors.fragments,
  fibers: mpColors.fibers,
  foams: mpColors.foams,
  films: mpColors.films,
  sheets: mpColors.sheets,
  pellets: mpColors.pellets,
}

// Series shown in the donut (updates when user filters via legend)
const displaySeries = ref([
  microplasticData.value.fragments,
  microplasticData.value.fibers,
  microplasticData.value.foams,
  microplasticData.value.films,
  microplasticData.value.sheets,
  microplasticData.value.pellets,
])

watch(microplasticData, nv => {
  displaySeries.value = selectedKey.value === null
    ? [nv.fragments, nv.fibers, nv.foams, nv.films, nv.sheets, nv.pellets]
    : [nv[selectedKey.value]]
})

const compositionOptions = ref({
  chart: { type: 'donut', height: 260, toolbar: { show: false } },
  labels: Object.values(labelsMap),
  colors: Object.values(mpColors),
  legend: { show: false },
  dataLabels: { enabled: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, fontSize: '16px' },
          value: { show: true, fontSize: '24px', fontWeight: '600' },
          total: {
            show: true,
            label: 'Total number of MP found',
            fontSize: '14px',
            formatter: function (w) {
              const total = Object.values(microplasticData.value).reduce((a, b) => a + b, 0)
              return total
            },
          },
        },
      },
    },
  },
})
function handleLegendClick(key) {
  if (selectedKey.value === key) {
    selectedKey.value = null
    displaySeries.value = [
      microplasticData.value.fragments,
      microplasticData.value.fibers,
      microplasticData.value.foams,
      microplasticData.value.films,
      microplasticData.value.sheets,
      microplasticData.value.pellets,
    ]
    compositionOptions.value.labels = Object.values(labelsMap)
    compositionOptions.value.colors = Object.values(mpColors)
    return
  }

  selectedKey.value = key
  displaySeries.value = [microplasticData.value[key]]
  compositionOptions.value.labels = [labelsMap[key]]
  compositionOptions.value.colors = [mpColors[key]]
}

// Site drilldown chart extracted into a module component: SiteDrilldownChart

// Column: microplastic counts by input type (aggregate)
// For each input type, compute total microplastic counts across sites that report using that input.
const inputTypes = ['Plastic mulching', 'Fertilizer sacks', 'Greenhouse plastic sheets/tunnels', 'Seedling trays (plastic)', 'Compost with visible plastics']

const inputTotals = computed(() => inputTypes.map(type => sites.value.reduce((acc, s) => {
  if (!siteHasActivity(s, type)) return acc
  const siteTotal = (Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.beads_count) || 0) + (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
  return acc + siteTotal
}, 0)))

const inputDrilldown = computed(() => inputTypes.map(type => {
  const sums = sites.value.reduce((acc, s) => {
    if (!siteHasActivity(s, type)) return acc
    acc[0] += (Number(s.fragment_count) || 0)
    acc[1] += (Number(s.fiber_count) || 0)
    acc[2] += (Number(s.foam_count) || 0)
    acc[3] += (Number(s.film_count) || 0)
    acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
    acc[5] += (Number(s.beads_count) || 0)
    return acc
  }, [0, 0, 0, 0, 0, 0])
  return sums
}))

// Small helper list for sample farms (name + contamination level based on total counts)
function contaminationLevel(site) {
  const total = (Number(site.fragment_count) || 0) + (Number(site.fiber_count) || 0) + (Number(site.film_count) || 0) + (Number(site.foam_count) || 0) + (Number(site.beads_count) || 0) + (Number(site.sheets_count) || Number(site.sheet_count) || Number(site.sheets) || 0)
  if (total > 700) return 'HIGH'
  if (total > 400) return 'MODERATE'
  if (total > 150) return 'LOW'
  return 'ZERO'
}

// Robust check for plastic activity membership.
// Directus may store `plastic_activity` as an array of strings, a comma-separated string,
// or an array of objects. Normalize to a set of lowercase tokens and test for inclusion.
function siteHasActivity(site, expected) {
  if (!site) return false
  const raw = site.plastic_activity
  if (!raw) return false
  const expectedNorm = (expected || '').toString().toLowerCase().trim()

  // If stored as array
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item && item !== 0) continue
      if (typeof item === 'string') {
        if (item.toLowerCase().includes(expectedNorm)) return true
      } else if (typeof item === 'object') {
        // try to find common label keys
        const cand = (item.name || item.title || item.label || item.value || '')
        if ((cand || '').toString().toLowerCase().includes(expectedNorm)) return true
      } else {
        if (String(item).toLowerCase().includes(expectedNorm)) return true
      }
    }
    return false
  }

  // If stored as string (comma-separated or single)
  if (typeof raw === 'string') {
    const parts = raw.split(/[;,|\n]/).map(p => p.trim().toLowerCase()).filter(Boolean)
    return parts.some(p => p.includes(expectedNorm))
  }

  // fallback: coerce and test
  try {
    const json = JSON.parse(String(raw))
    if (Array.isArray(json)) return json.some(x => (String(x || '').toLowerCase() || '').includes(expectedNorm))
  } catch {
    // ignore
  }
  return String(raw).toLowerCase().includes(expectedNorm)
}

// Normalize site display names: omit the word "farm" (case-insensitive) and tidy spacing
function sanitizeSiteName(name) {
  if (!name) return ''
  // remove the standalone word 'farm' (case-insensitive), and common separators
  let s = String(name).replace(/\b[Ff]arm\b/g, '')
  // remove multiple spaces and stray punctuation at ends
  s = s.replace(/[\-–—_/]+/g, ' ')
  s = s.replace(/\s{2,}/g, ' ').trim()
  // remove trailing commas or dashes
  s = s.replace(/^[,\s]+|[,\s]+$/g, '')
  return s
}

const sampledSites = computed(() => sites.value.map(s => ({ id: s.id, site_name: sanitizeSiteName(s.site_name), address: s.address, level: contaminationLevel(s) })))

// Prepare site-based drilldown data (to keep the original site drilldown behavior)
const siteCategories = computed(() => sites.value.map(s => sanitizeSiteName(s.site_name || '')))
const siteTotals = computed(() => sites.value.map(s => (
  (Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0) + (Number(s.beads_count) || 0)
)))
const siteDrilldown = computed(() => sites.value.map(s => [
  Number(s.fragment_count) || 0,
  s.fiber_count || 0,
  s.foam_count || 0,
  s.film_count || 0,
  s.sheets_count || s.sheet_count || s.sheets || 0,
  s.beads_count || 0,
]))

const numOrganic = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('organic')).length)
const numConventional = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('conventional')).length)
const numIntegrated = computed(() => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes('integrated')).length)

// Contamination by farm practice (sum counts per practice) - include all 5 categories
const categoriesForPracticeChart = ['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']
const practiceKeys = ['conventional', 'fully organic', 'integrated']
const practiceNames = ['Conventional Practice', 'Organic Practice', 'Integrated Practice']

const fragmentsByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.fragment_count) || 0), 0)))
const fibersByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.fiber_count) || 0), 0)))
const filmsByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.film_count) || 0), 0)))
const foamsByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.foam_count) || 0), 0)))
const sheetsByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.sheets_count) || Number(b.sheet_count) || Number(b.sheets) || 0), 0)))
const pelletsByPractice = computed(() => practiceKeys.map(k => sites.value.filter(s => (s.cultivation_practice || '').toLowerCase().includes(k)).reduce((a, b) => a + (Number(b.beads_count) || 0), 0)))

const contaminationByPracticeSeries = computed(() => practiceNames.map((name, idx) => ({
  name,
  data: [
    fragmentsByPractice.value[idx] || 0,
    fibersByPractice.value[idx] || 0,
    foamsByPractice.value[idx] || 0,
    filmsByPractice.value[idx] || 0,
    sheetsByPractice.value[idx] || 0,
    pelletsByPractice.value[idx] || 0,
  ],
})))

const allVals = computed(() => contaminationByPracticeSeries.value.flatMap(s => s.data))
const maxVal = computed(() => (allVals.value.length > 0 ? Math.max(...allVals.value) : 700))

const contaminationByPracticeOptions = computed(() => getDefaultBarOptions(categoriesForPracticeChart, {
  chart: { type: 'bar' },
  plotOptions: { bar: { horizontal: false } },
  legend: { position: 'bottom' },
  yaxis: { title: { text: 'Number of MP found (in Thousands)' }, min: 0, max: Math.ceil(maxVal.value * 1.15) },
}))

// Microplastic count by soil texture (aggregate)
const textures = computed(() => Array.from(new Set(sites.value.map(s => s.soil_type || 'Unknown'))))
const byTextureSeries = computed(() => ([
  { name: 'Fragments', data: textures.value.map(t => sites.value.filter(s => (s.soil_type || '') === t).reduce((a, b) => a + (Number(b.fragment_count) || 0), 0)) },
  { name: 'Fibers', data: textures.value.map(t => sites.value.filter(s => (s.soil_type || '') === t).reduce((a, b) => a + (Number(b.fiber_count) || 0), 0)) },
]))
const byTextureOptions = computed(() => ({ chart: { type: 'bar', toolbar: { show: false } }, xaxis: { categories: textures.value }, plotOptions: { bar: { horizontal: false } } }))

const textureTotals = computed(() => textures.value.map(t => sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
  return acc + ((Number(s.fragment_count) || 0) + (Number(s.fiber_count) || 0) + (Number(s.film_count) || 0) + (Number(s.foam_count) || 0) + (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0) + (Number(s.beads_count) || 0))
}, 0)))

const textureDrilldown = computed(() => textures.value.map(t => {
  const vals = sites.value.filter(s => (s.soil_type || '') === t).reduce((acc, s) => {
    acc[0] += (Number(s.fragment_count) || 0)
    acc[1] += (Number(s.fiber_count) || 0)
    acc[2] += (Number(s.foam_count) || 0)
    acc[3] += (Number(s.film_count) || 0)
    acc[4] += (Number(s.sheets_count) || Number(s.sheet_count) || Number(s.sheets) || 0)
    acc[5] += (Number(s.beads_count) || 0)
    return acc
  }, [0, 0, 0, 0, 0, 0])
  return vals
}))

// Color counts & size ranges are not in datasource; create simple derived mock distributions based on totals
const colors = ['Gray', 'Blue', 'White', 'Transparent']
const colorSeries = computed(() => ([
  { name: 'Fragments', data: [Math.round(totalFragments.value * 0.35), Math.round(totalFragments.value * 0.3), Math.round(totalFragments.value * 0.2), Math.round(totalFragments.value * 0.15)] },
  { name: 'Fibers', data: [Math.round(totalFibers.value * 0.4), Math.round(totalFibers.value * 0.25), Math.round(totalFibers.value * 0.25), Math.round(totalFibers.value * 0.1)] },
]))
const colorOptions = computed(() => ({ chart: { type: 'bar', toolbar: { show: false } }, xaxis: { categories: colors }, plotOptions: { bar: { horizontal: false } }, legend: { position: 'top' } }))

const colorDrilldown = computed(() => {
  const colorSeriesMap = {}
  for (const s of colorSeries.value) {
    colorSeriesMap[s.name.toLowerCase()] = s.data.slice()
  }
  const fragmentsColorBase = colorSeriesMap['fragments'] || (colorSeries.value[0] ? colorSeries.value[0].data : [0, 0, 0, 0])
  const fibersColorBase = colorSeriesMap['fibers'] || (colorSeries.value[1] ? colorSeries.value[1].data : fragmentsColorBase)

  return colors.map((_, idx) => {
    const fragVal = (colorSeriesMap['fragments'] && colorSeriesMap['fragments'][idx]) || Math.round(fragmentsColorBase[idx] * (totalFragments.value / Math.max(1, fragmentsColorBase.reduce((a, b) => a + b, 0))))
    const fiberVal = (colorSeriesMap['fibers'] && colorSeriesMap['fibers'][idx]) || Math.round(fibersColorBase[idx] * (totalFibers.value / Math.max(1, fibersColorBase.reduce((a, b) => a + b, 0))))
    const foamVal = Math.round((fragVal) * (totalFoams.value / Math.max(1, totalFragments.value || 1)))
    const filmVal = Math.round((fragVal) * (totalFilms.value / Math.max(1, totalFragments.value || 1)))
    const sheetVal = Math.round((fragVal) * (totalSheets.value / Math.max(1, totalFragments.value || 1)))
    const pelletVal = Math.round((fragVal) * (totalPellets.value / Math.max(1, totalFragments.value || 1)))
    return [fragVal, fiberVal, foamVal, filmVal, sheetVal, pelletVal]
  })
})

const colorTotals = computed(() => colorDrilldown.value.map(arr => arr.reduce((a, b) => a + b, 0)))

// --- Aggregate microplastics by color across ALL sites (using Directus microplastics records)
const colorComparisonAll = ref(null)

function morphologyIndex(morph) {
  const m = (morph || '').toString().toLowerCase()
  if (m.includes('fragment')) return 0
  if (m.includes('fiber') || m.includes('fibre')) return 1
  if (m.includes('foam')) return 2
  if (m.includes('film')) return 3
  if (m.includes('sheet')) return 4
  if (m.includes('pellet') || m.includes('bead')) return 5
  return -1
}

async function fetchColorComparisonAllSites() {
  try {
    const resp = await directus.request(readItems('microplastics', { limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (!items || items.length === 0) {
      colorComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
      return colorComparisonAll.value
    }

    const normalizeRaw = s => (s || '').toString().trim()
    const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'

    const counts = new Map()
    for (const it of items) {
      const rawColor = it.color || it.color_bucket || it.colour || ''
      const norm = normKey(rawColor)
      if (!counts.has(norm)) counts.set(norm, { count: 0, raws: new Map(), drilldown: [0, 0, 0, 0, 0, 0] })
      const obj = counts.get(norm)
      const sampleCount = Number(it.count || it.particle_count || it.quantity || it.number || it.num_particles || it.particle_count_per_sample || 1)
      obj.count += sampleCount
      obj.raws.set(normalizeRaw(rawColor), (obj.raws.get(normalizeRaw(rawColor)) || 0) + sampleCount)

      const morph = it.shape || it.morphology || it.mp_category || it.type
      const idx = morphologyIndex(morph)
      if (idx >= 0) {
        obj.drilldown[idx] = (obj.drilldown[idx] || 0) + sampleCount
      } else {
        obj.unknown = (obj.unknown || 0) + 1
      }
    }

    const arr = Array.from(counts.entries()).map(([norm, v]) => {
      const topRaw = Array.from(v.raws.entries()).toSorted((a, b) => b[1] - a[1])[0]?.[0] || norm
      const display = String(topRaw).trim().startsWith('#') ? topRaw.trim() : topRaw.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      return { norm, display, count: v.count, drilldown: v.drilldown, unknown: v.unknown || 0 }
    }).toSorted((a, b) => b.count - a.count)

    const topN = 12
    const explicit = arr.slice(0, topN)
    const other = arr.slice(topN)

    const categories = explicit.map(x => x.display)
    const totals = explicit.map(x => x.count)
    const drilldown = explicit.map(x => x.drilldown)

    if (other.length > 0) {
      const otherTotals = other.reduce((acc, it) => acc + it.count, 0)
      const otherDrill = other.reduce((acc, it) => acc.map((v, i) => v + (it.drilldown[i] || 0)), [0, 0, 0, 0, 0, 0])
      categories.push('Other')
      totals.push(otherTotals)
      drilldown.push(otherDrill)
    }

    const known = { gray: '#9e9e9e', grey: '#9e9e9e', blue: '#1976d2', white: '#ffffff', transparent: '#cfd8dc', black: '#000000', green: '#2E7D32' }
    const colorsArr = categories.map(label => {
      const key = (label || '').toString().toLowerCase()
      if (known[key]) return known[key]
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(label)) return label
      let h = 0
      for (let i = 0; i < label.length; i++) h = (h * 31 + (label.codePointAt(i) || 0)) % 360
      return `hsl(${h},60%,45%)`
    })

    colorComparisonAll.value = { categories, totals, drilldown, overviewColors: colorsArr }
    return colorComparisonAll.value
  } catch (err) {
    console.error('Error fetching microplastics for color comparison (all sites)', err)
    colorComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
    return colorComparisonAll.value
  }
}

const sizeRanges = ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm']
const sizeSeries = computed(() => ([
  { name: 'Fragments', data: [20, 40, 60, 30, 15].map(v => Math.round(v * (totalFragments.value / Math.max(1, 200)))) },
  { name: 'Fibers', data: [15, 30, 50, 20, 10].map(v => Math.round(v * (totalFibers.value / Math.max(1, 150)))) },
]))
const sizeOptions = computed(() => ({ chart: { type: 'bar', stacked: true, toolbar: { show: false } }, xaxis: { categories: sizeRanges }, plotOptions: { bar: { horizontal: false } } }))

const sizeDrilldown = computed(() => {
  const sizeSeriesMap = {}
  for (const s of sizeSeries.value) {
    sizeSeriesMap[s.name.toLowerCase()] = s.data.slice()
  }
  const fragmentsSizeBase = sizeSeriesMap['fragments'] || (sizeSeries.value[0] ? sizeSeries.value[0].data : [0, 0, 0, 0, 0])
  const fibersSizeBase = sizeSeriesMap['fibers'] || (sizeSeries.value[1] ? sizeSeries.value[1].data : fragmentsSizeBase)

  return sizeRanges.map((_, idx) => {
    const fragVal = (sizeSeriesMap['fragments'] && sizeSeriesMap['fragments'][idx]) || Math.round(fragmentsSizeBase[idx] * (totalFragments.value / Math.max(1, fragmentsSizeBase.reduce((a, b) => a + b, 0))))
    const fiberVal = (sizeSeriesMap['fibers'] && sizeSeriesMap['fibers'][idx]) || Math.round(fibersSizeBase[idx] * (totalFibers.value / Math.max(1, fibersSizeBase.reduce((a, b) => a + b, 0))))
    const foamVal = Math.round(fragVal * (totalFoams.value / Math.max(1, totalFragments.value || 1)))
    const filmVal = Math.round(fragVal * (totalFilms.value / Math.max(1, totalFragments.value || 1)))
    const sheetVal = Math.round(fragVal * (totalSheets.value / Math.max(1, totalFragments.value || 1)))
    const pelletVal = Math.round(fragVal * (totalPellets.value / Math.max(1, totalFragments.value || 1)))
    return [fragVal, fiberVal, foamVal, filmVal, sheetVal, pelletVal]
  })
})

const sizeTotals = computed(() => sizeDrilldown.value.map(arr => arr.reduce((a, b) => a + b, 0)))

const aiSummaryText = 'Based on the data, farms practicing organic cultivation tend to have lower microplastic contamination levels compared to conventional farms. Implementing integrated pest management and reducing plastic mulch usage could further mitigate contamination risks.'

// --- Aggregate microplastics by size range across ALL sites (using Directus microplastics records)
const sizeComparisonAll = ref(null)

function parseSizeToMicron(raw) {
  if (raw === null || raw === undefined) return NaN
  const s = String(raw).trim()
  if (!s) return NaN

  // If a numeric field already (number or numeric string)
  const asNum = Number(s.replace(/,/g, ''))
  if (!Number.isNaN(asNum) && /\d/.test(s) && !/[a-zA-Zµμ]/.test(s)) {
    // assume already microns when no unit specified is risky; treat as µm
    return asNum
  }

  // Look for explicit unit indicators
  // Examples: '0.5 mm', '500 µm', '1-5 mm', '20-100 µm'
  const rangeMatch = s.match(/([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*(mm|cm|µm|um|μm)?/i)
  if (rangeMatch) {
    const a = Number(rangeMatch[1])
    const b = Number(rangeMatch[2])
    const unit = (rangeMatch[3] || '').toLowerCase()
    let factor = 1
    if (unit === 'mm') factor = 1000
    if (unit === 'cm') factor = 10000
    // µm/um/μm -> factor =1
    return ((a + b) / 2) * factor
  }

  // Single value with unit
  const singleMatch = s.match(/([\d.]+)\s*(mm|cm|µm|um|μm)?/i)
  if (singleMatch) {
    const v = Number(singleMatch[1])
    const unit = (singleMatch[2] || '').toLowerCase()
    if (unit === 'mm') return v * 1000
    if (unit === 'cm') return v * 10000
    return v // assume µm
  }

  // fallback: try to extract first number and assume µm
  const numMatch = s.match(/([\d.]+)/)
  if (numMatch) return Number(numMatch[1])
  return NaN
}

async function fetchSizeComparisonAllSites(fieldKey = null) {
  try {
    const resp = await directus.request(readItems('microplastics', { limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (!items || items.length === 0) {
      sizeComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
      return sizeComparisonAll.value
    }

    // buckets (in micrometers)
    const buckets = [{ label: '1-20 µm', min: 1, max: 20 }, { label: '20-100 µm', min: 20, max: 100 }, { label: '100-500 µm', min: 100, max: 500 }, { label: '500 µm-1 mm', min: 500, max: 1000 }, { label: '1-5 mm', min: 1000, max: 5000 }]

    const totals = new Array(buckets.length).fill(0)
    const drilldown = new Array(buckets.length).fill(0).map(() => [0, 0, 0, 0, 0, 0])
    let unknownTotal = 0
    let unknownDrill = [0, 0, 0, 0, 0, 0]

    for (const it of items) {
      const sampleCount = Number(it.count || it.particle_count || it.quantity || it.number || it.num_particles || it.particle_count_per_sample || 1) || 0
      let sizeUm = NaN
      if (fieldKey) {
        // prefer numeric field indicated by the dropdown
        const raw = it[fieldKey]
        let val = toNumber(raw)
        if ((fieldKey === 'area_um2' || fieldKey === 'area') && !Number.isFinite(val) && it.area) val = toNumber(it.area)
        if (fieldKey === 'area_um2') val = areaToDiameter(val)
        if (Number.isFinite(val)) sizeUm = val
      }

      // fallback: try parse textual size fields
      if (!Number.isFinite(sizeUm)) {
        const rawSize = it.size || it.size_range || it.particle_size || it.particle_size_um || it.particle_size_mm || it.length || ''
        const parsed = parseSizeToMicron(rawSize)
        if (!Number.isNaN(parsed)) sizeUm = parsed
      }

      let bucketIdx = -1
      if (Number.isFinite(sizeUm)) {
        for (let i = 0; i < buckets.length; i++) {
          const b = buckets[i]
          if (sizeUm >= b.min && sizeUm <= b.max) {
            bucketIdx = i
            break
          }
        }
        if (bucketIdx === -1 && sizeUm > buckets[buckets.length - 1].max) bucketIdx = buckets.length - 1
      }

      const morph = it.shape || it.morphology || it.mp_category || it.type
      const morphIdx = morphologyIndex(morph)

      if (bucketIdx >= 0) {
        totals[bucketIdx] += sampleCount
        if (morphIdx >= 0) drilldown[bucketIdx][morphIdx] = (drilldown[bucketIdx][morphIdx] || 0) + sampleCount
      } else {
        unknownTotal += sampleCount
        if (morphIdx >= 0) unknownDrill[morphIdx] += sampleCount
      }
    }

    const categories = buckets.map(b => b.label)
    if (unknownTotal > 0) {
      categories.push('Other')
      totals.push(unknownTotal)
      drilldown.push(unknownDrill)
    }

    // generate overview colors (gradient hues)
    const colorsArr = categories.map((_, idx) => {
      const hue = Math.round(220 - (idx * (200 / Math.max(1, categories.length - 1))))
      return `hsl(${hue},60%,45%)`
    })

    sizeComparisonAll.value = { categories, totals, drilldown, overviewColors: colorsArr }
    return sizeComparisonAll.value
  } catch (err) {
    console.error('Error fetching microplastics for size comparison (all sites)', err)
    sizeComparisonAll.value = { categories: [], totals: [], drilldown: [], overviewColors: [] }
    return sizeComparisonAll.value
  }
}

// Measurement field selection (match farm view behavior)
const measurementFields = [
  { key: 'equivalent_circular_diameter_um', label: 'Equivalent Circular Diameter (µm)' },
  { key: 'major_axis_um', label: 'Major Axis (µm)' },
  { key: 'minor_axis_um', label: 'Minor Axis (µm)' },
  { key: 'skeleton_length_um', label: 'Skeleton Length (µm)' },
  { key: 'area_um2', label: 'Area (µm²) — converted to diameter' },
  { key: 'perimeter_um', label: 'Perimeter (µm)' },
  { key: 'aspect_ratio', label: 'Aspect Ratio' },
]

const selectedSizeField = ref('equivalent_circular_diameter_um')

function toNumber(v) {
  if (v == null || v === '') return Number.NaN
  const n = Number(v)
  return Number.isNaN(n) ? Number.NaN : n
}

function areaToDiameter(area) {
  if (!Number.isFinite(area) || area <= 0) return Number.NaN
  return 2 * Math.sqrt(area / Math.PI)
}

const sizeBuckets = [
  { label: '1-20 µm', min: 1, max: 20 },
  { label: '20-100 µm', min: 20, max: 100 },
  { label: '100-500 µm', min: 100, max: 500 },
  { label: '500 µm-1 mm', min: 500, max: 1000 },
  { label: '1-5 mm', min: 1000, max: 5000 },
]

function bucketForValue(val) {
  if (!Number.isFinite(val)) return -1
  for (const [i, b] of sizeBuckets.entries()) {
    if (val >= b.min && val < b.max) return i
  }
  if (val >= sizeBuckets.at(-1).min) return sizeBuckets.length - 1
  return -1
}

// Watch selected field and re-run aggregation
watch(selectedSizeField, async (nv) => {
  try {
    await fetchSizeComparisonAllSites(nv)
  } catch {
    // ignore
  }
})

// Map setup
const mapRef = ref(null)

function colorForLevel(level) {
  const l = (level || '').toString().toUpperCase().trim()
  switch (l) {
    case 'HIGH': return '#d32f2f'
    case 'MODERATE': return '#fb8c00'
    case 'LOW': return '#43a047'
    default: return '#9e9e9e'
  }
}

function printReport() {
  window.print()
}

onMounted(async () => {
  // load data then initialize any map markers that depend on data
  await loadSites()
  // fetch latest soilsample date for the region
  // use shared composable to populate latest sample date (best-effort)
  try {
    await fetchLatestSampleDate()
  } catch (err) {
    // ignore composable fetch errors here
  }
  // fetch aggregated microplastics by color across all sites
  try {
    await fetchColorComparisonAllSites()
  } catch (err) {
    // ignore
  }

  // fetch aggregated microplastics by size across all sites (use selected field)
  try {
    await fetchSizeComparisonAllSites(selectedSizeField.value)
  } catch (err) {
    // ignore
  }

  if (!mapRef.value || typeof window === 'undefined') return
  const map = L.map(mapRef.value, { scrollWheelZoom: false }).setView([14.03, 121.58], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map)

  const markers = []
  for (const site of sites.value) {
    if (!site.latitude || !site.longitude) continue
    const lvl = contaminationLevel(site)
    const color = colorForLevel(lvl)
    const marker = L.circleMarker([site.latitude, site.longitude], {
      radius: 9,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      fillOpacity: 0.95,
    }).bindPopup(`<strong>${site.site_name}</strong><br/>${site.address}<br/>Level: ${lvl}`)
    marker.addTo(map)
    markers.push([site.latitude, site.longitude])
  }
  if (markers.length > 0) {
    map.fitBounds(markers, { padding: [40, 40] })
  }
})

// Most common crops
// Accept both arrays and comma/semicolon/pipe-separated strings. Normalize to lowercase+trim and
// count each crop at most once per site so that a crop listed multiple times for the same site
// only contributes a single count for that site.
const cropCounts = computed(() => {
  const counts = {}
  for (const s of sites.value) {
    let raw = s.crops
    if (!raw) continue

    // Normalize to array
    if (typeof raw === 'string') raw = raw.split(/[;,|\n]/).map(x => x.trim())
    if (!Array.isArray(raw)) continue

    const seen = new Set()
    for (const item of raw) {
      if (item === null || item === undefined) continue
      const key = String(item).toLowerCase().trim()
      if (!key) continue
      seen.add(key)
    }

    for (const k of seen) counts[k] = (counts[k] || 0) + 1
  }
  return counts
})

const sortedCrops = computed(() => Object.entries(cropCounts.value).toSorted((a, b) => b[1] - a[1]))
const titleCase = (s) => String(s || '').split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ')
const topCrops = computed(() => sortedCrops.value.slice(0, 10).map(([crop, count]) => ({ crop: titleCase(crop), count })))

// Farm size distribution: small <1ha, medium 1-3ha, large >3ha
const farmSizeCounts = computed(() => ({
  small: sites.value.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha < 1).length,
  medium: sites.value.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha >= 1 && s.land_area_ha <= 3).length,
  large: sites.value.filter(s => typeof s.land_area_ha === 'number' && s.land_area_ha > 3).length,
}))
const farmSizeSeries = computed(() => ([{ name: 'Farms', data: [farmSizeCounts.value.small, farmSizeCounts.value.medium, farmSizeCounts.value.large] }]))
const farmSizeOptions = computed(() => ({ chart: { type: 'bar', toolbar: { show: false } }, xaxis: { categories: ['Small (<1ha)', 'Medium (1-3ha)', 'Large (>3ha)'] }, plotOptions: { bar: { horizontal: false, columnWidth: '80%' } }, legend: { show: false } }))

</script>

<template>
  <div class="insight-page">
    <header class="page-header">
      <div class="d-flex align-center">
        <VIcon color="grey" size="x-large" style="cursor:pointer; vertical-align:middle;" @click="$router.back()">
          mdi-menu-left</VIcon>
        <h1>Tayabas
          City, Quezon Province, Philippines</h1>
      </div>
    </header>

    <div class="columns">
      <div class="kpi">
        <div class="kpi-num">{{ sites.length }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Number of Sampled Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numOrganic }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Organic Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numConventional }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Conventional Farms</div>
      </div>
      <div class="kpi">
        <div class="kpi-num">{{ numIntegrated }}</div>
        <div class="v-separator" />
        <div class="kpi-body">Integrated Farms</div>
      </div>
      <div class="d-flex align-center justify-center bg-blue ga-2 rounded-lg cursor-pointer"
        style=" box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
        <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
        <p class="text-h4 text-white font-weight-bold">Print Report</p>
      </div>
    </div>
    <VRow class="mt-2">
      <VCol class="d-flex flex-column justify-space-between" cols="3">
        <div class="card crops-card" style="height: 38%;">
          <h3>Most Common Crops Grown</h3>
          <ul class="crop-list">
            <li v-for="c in topCrops" :key="c.crop">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="crop-name">{{ c.crop }}</span>
              </div>
            </li>
          </ul>
        </div>
        <div class="card" style="height: 58%;">
          <h3>Size Distribution of Sampled Farms</h3>
          <ApexChartBase :height="230" :options="farmSizeOptions" :series="farmSizeSeries" type="bar" />
        </div>
      </VCol>

      <VCol cols="4">
        <div class="card">
          <MPDonutChart :active-key="selectedKey" :colors="donutColors" :labels-map="donutLabelsMap"
            :microplastic-data="microplasticData" @selection="handleLegendClick" />
        </div>
      </VCol>

      <VCol cols="5">
        <div class="card">
          <SiteDrilldownChart :categories="siteCategories"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="siteDrilldown" :height="425" title="Microplastic Count by Farm Site" :totals="siteTotals" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="6">
        <div class="card">
          <MPPracticeBar :height="400" :options="contaminationByPracticeOptions" :series="contaminationByPracticeSeries"
            :subtitle="`Data as of ${displayLatestSampleDate}`" title="Contamination Comparison by Farm Practices" />
        </div>
      </VCol>
      <VCol cols="6">
        <MonthlyTrendChart :colors="mpColors" :microplastic-data="microplasticData"
          :subtitle="`Data as of ${displayLatestSampleDate}`" />
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol cols="7">
        <div class="card">
          <SiteDrilldownChart :categories="inputTypes"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="inputDrilldown" title="Microplastic Counts by Plastic-Related Farm Inputs"
            :totals="inputTotals" />
        </div>
      </VCol>
      <VCol cols="5">
        <div class="card">
          <SiteDrilldownChart :categories="textures"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="textureDrilldown" title="Microplastic Count by Soil Texture" :totals="textureTotals" />
        </div>
      </VCol>
    </VRow>

    <VRow class="mt-2">
      <VCol class="d-flex flex-column justify-space-between" cols="6">
        <div class="card bottom-card">
          <SiteDrilldownChart
            :categories="(colorComparisonAll && colorComparisonAll.categories) ? colorComparisonAll.categories : colors"
            :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
            :drilldown="(colorComparisonAll && colorComparisonAll.drilldown) ? colorComparisonAll.drilldown : colorDrilldown"
            :height="250" title="Microplastic Count by Color"
            :totals="(colorComparisonAll && colorComparisonAll.totals) ? colorComparisonAll.totals : colorTotals"
            :overview-colors="(colorComparisonAll && colorComparisonAll.overviewColors) ? colorComparisonAll.overviewColors : []"
            :use-overview-colors="Boolean(colorComparisonAll)" />
        </div>

        <div class="card bottom-card">
          <MPSizeRangeAll :height="220" title="Microplastic Count by Size Range" />
        </div>

        <div class="card bottom-card">
          <div class="d-flex align-center">
            <h3>AI Insights</h3>
            <VIcon class="ml-2" color="blue">mdi-creation</VIcon>
          </div>
          <p class="subtitle mb-2">Generated on {{ displayLatestSampleDate }}</p>
          <div class="summary-box">
            <p>{{ aiSummaryText }}</p>
          </div>
        </div>
      </VCol>

      <VCol cols="6">
        <div class="card list-card map-card">
          <h3 class="mb-2">Sampled Farms</h3>
          <!-- list moved to SampledFarms component to make it reusable -->
          <!-- pass full `sites` (contains latitude/longitude) so the map can render markers -->
          <SampledFarms :sampled-sites="sites" />
        </div>
      </VCol>
    </VRow>
  </div>
</template>

<style scoped>
.insight-page {
  padding: 2em;
  background-color: #f2f2f8;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px
}

.page-header {
  color: var(--v-theme-on-surface);
  opacity: 0.8
}

.subtitle {
  color: rgb(155, 155, 155)
}

.kpis {
  display: flex;
  gap: 12px
}

.kpi {
  display: flex;
  gap: 20px;
  align-items: center;
  background: white;
  padding: 12px 32px;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
}

.kpi-num {
  font-size: 32px;
  font-weight: 700;
}

.v-separator {
  width: 3px;
  height: 80%;
  background-color: rgba(0, 0, 0, 0.1);
}

.kpi-body {
  font-size: 20px;
  font-weight: 700;
  line-height: 110%;
  color: rgba(0, 0, 0, 0.7);
}

.columns {
  /* Make this 5-column layout using repeat */
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  flex-wrap: wrap;
}

.main-col {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px
}

.side-col {
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px
}

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
  height: 100%;
}

.bottom-card {
  min-height: 320px;
}

/* Add margin-top to every .bottom-card except the first */
.bottom-card:not(:first-of-type) {
  margin-top: 1.3em;
  /* adjust as needed */
}

.list-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 340px;
  overflow: auto
}

.list-card li {
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, .06);
  display: flex;
  flex-direction: column;
}

.farm-name {
  font-weight: 600
}

.farm-addr {
  color: rgba(0, 0, 0, .6);
  font-size: 13px
}

.map-card {
  padding: 20px;
}

.map-card #map {
  width: 100%;
  height: 320px;
}

.crops-card {
  padding: 20px;
}

.crop-list {
  margin: 0;
  /* padding-left: 0; */
  columns: 2;
  column-gap: 18px;
  /* list-style-position: inside */
  list-style: none;
}

.crop-list li {
  color: rgba(0, 0, 0, 0.85);
  break-inside: avoid-column;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1976d2;
  padding: 12px 16px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .crop-list {
    columns: 1
  }
}

.farm-level[data-level='HIGH'] {
  color: #b71c1c;
  font-weight: 700
}

.farm-level[data-level='MODERATE'] {
  color: #ff9800;
  font-weight: 700
}

.farm-level[data-level='LOW'] {
  color: #4caf50;
  font-weight: 700
}

.farm-level[data-level='ZERO'] {
  color: #9e9e9e;
  font-weight: 700
}

@media (max-width: 1100px) {
  .main-col {
    grid-template-columns: 1fr
  }

  .side-col {
    width: 320px
  }
}

@media (max-width: 900px) {
  .columns {
    flex-direction: column
  }

  .side-col {
    width: 100%
  }

  .main-col {
    grid-template-columns: 1fr
  }
}
</style>

/* Styles reused from PreviewCard.vue to keep the Microplastic Composition card visually consistent */
<style scoped>
.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 1em;
  padding: 0.7em 1em;
  border-radius: 0.5em;
  color: white;
  cursor: pointer;
  transition: opacity 0.3s;
}

.legend-item p {
  margin: 0;
  font-size: 1em;
}

.separator {
  width: 2px;
  height: 2.5em;
  background-color: #ffffff;
  margin: 0 1em;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #1976d2;
  padding: 12px16px;
  margin-top: 8px;
}
</style>
