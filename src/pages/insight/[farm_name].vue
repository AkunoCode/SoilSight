<script setup>
import { readItems } from '@directus/sdk'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
import MPSizeRangeChart from '@/components/graphs/MPSizeRangeChart.vue'
import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'

// Directus helper
import directus from '@/composables/useDirectus'
import LeafletMap from '../../components/LeafletMap.vue'

// Routing / params
const route = useRoute()
const farmParam = computed(() => route.params.farm_name || '')

// Local cache of sites (kept as a simple array for lookups)
const sites = []
const comparisonSites = ref(null)

// Primary reactive state
const farm = ref(null)
const latestSampleDate = ref(null)
const colorComparisonFetched = ref(null)
const colorComparisonLoading = ref(false)

// UI / static content
const aiSummaryText = `Soil analysis from Green Valley’s high-value crop farms indicates that fragments are the dominant form of microplastics, followed by films. This pattern is likely linked to the widespread use of plastic mulching, as the color and texture of the detected films correspond to mulching sheets and seedling trays commonly used in the area. The farms’ clay loam soil structure may also contribute to microplastic retention, while irrigation water is a possible additional source of contamination.

These findings suggest heightened risks of soil degradation, reduced microbial activity, and potential transfer of microplastics into the food chain through crop uptake. Over time, this could undermine both soil health and agricultural productivity.

It is recommended that farmers adopt more sustainable practices such as reducing reliance on single-use plastics, improving waste collection and disposal, and exploring biodegradable alternatives for mulching and seedling propagation. Regular monitoring of both soil and irrigation water quality is also advised to mitigate long-term risks.`

import useLatestSampleDate from '@/composables/useLatestSampleDate.js'
import { useAppStore } from '@/stores/app'
const app = useAppStore()
const { displayLatestSampleDate } = useLatestSampleDate()

const formattedDate = computed(() => displayLatestSampleDate.value)

const displaySampleDate = computed(() => {
  const d = latestSampleDate.value
  if (!d) return formattedDate.value
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return formattedDate.value
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return formattedDate.value
  }
})

const plasticActivityList = [
  'Plastic Fertilizer Sacks',
  'Plastic Mulching',
  'Seedling Trays (plastic)',
  'Compost with visible plastics',
  'Greenhouse plastic sheets/tunnels',
]

const cultivationDefinitions = {
  'Fully Organic': 'An agricultural practice that avoids synthetic chemicals and fertilizers, relying on natural processes and materials to maintain soil fertility, manage pests, and promote ecosystem health.',
  'Integrated': 'A sustainable farming approach that combines biological, cultural, mechanical, and chemical methods in a balanced way to optimize crop production while minimizing environmental impact.',
  'Conventional': 'A traditional farming method that typically relies on synthetic fertilizers, pesticides, and other chemicals to maximize crop yields, often with less emphasis on ecological sustainability.',
}

function getCultivationDefinition(practice) {
  if (!practice) return ''
  if (cultivationDefinitions[practice]) return cultivationDefinitions[practice]
  const p = String(practice).toLowerCase()
  if (p.includes('organic')) return cultivationDefinitions['Fully Organic']
  if (p.includes('integrated')) return cultivationDefinitions['Integrated']
  if (p.includes('conventional')) return cultivationDefinitions['Conventional']
  return ''
}

function slugify(str) {
  if (!str) return ''
  return String(str).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
}

function normalizeActivityName(s) {
  if (!s) return ''
  return String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\bplastic\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const farmNormalizedActivities = computed(() => {
  const items = farm.value?.plastic_activity || []
  return new Set(items.map(x => normalizeActivityName(x)).filter(Boolean))
})

function farmHasActivity(activity) {
  if (!activity) return false
  return farmNormalizedActivities.value.has(normalizeActivityName(activity))
}

const waterIcon = computed(() => {
  const raw = farm.value?.water_source
  const ws = Array.isArray(raw) ? raw.join(' ').toLowerCase() : (raw || '').toLowerCase()
  if (!ws) return 'mdi-water'
  if (/rain/.test(ws)) return 'mdi-weather-rainy'
  if (/well|groundwater|deep well/.test(ws)) return 'mdi-water-pump'
  if (/municipal|supply|city/.test(ws)) return 'mdi-city'
  if (/irrigation|canal/.test(ws)) return 'mdi-waves'
  return 'mdi-water'
})

function titleCaseString(s) {
  if (s == null) return ''
  const str = String(s).toLowerCase()
  return str.split(/(\s|\-)/).map(part => {
    if (/^\s|\-$/g.test(part)) return part
    return part.charAt(0).toUpperCase() + part.slice(1)
  }).join('')
}

function titleCase(val) {
  if (val == null) return ''
  return Array.isArray(val) ? val.map(v => titleCaseString(v)).join(', ') : titleCaseString(val)
}

function _findFarmByParam(param) {
  if (!param) return null
  const decoded = decodeURIComponent(String(param))
  const key = slugify(decoded)
  let found = sites.find(s => slugify(s.site_name) === key)
  if (found) return found
  found = sites.find(s => (s.site_name || '').toLowerCase() === decoded.toLowerCase())
  if (found) return found
  found = sites.find(s => (s.site_name || '').toLowerCase().includes(decoded.toLowerCase()))
  return found || null
}

async function fetchSitesByPractice(practice) {
  if (!practice) return null
  try {
    const resp = await directus.request(readItems('sites', { filter: { cultivation_practice: { _contains: practice } }, limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    return items || []
  } catch (error) {
    console.error('Error fetching sites by practice from Directus', error)
    return null
  }
}

async function fetchFarmFromDirectus(param) {
  if (!param) return null
  const decoded = decodeURIComponent(String(param))
  try {
    const resp = await directus.request(readItems('sites', { filter: { site_name: { _eq: decoded } }, limit: 1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (items && items.length > 0) {
      sites.splice(0, sites.length, ...items)
      return items[0]
    }
    const allResp = await directus.request(readItems('sites'))
    const allItems = Array.isArray(allResp) ? allResp : (allResp?.data || [])
    if (Array.isArray(allItems) && allItems.length > 0) {
      sites.splice(0, sites.length, ...allItems)
      let found = allItems.find(s => slugify(s.site_name) === key)
      if (found) return found
      found = allItems.find(s => (s.site_name || '').toLowerCase() === decoded.toLowerCase())
      if (found) return found
      found = allItems.find(s => (s.site_name || '').toLowerCase().includes(decoded.toLowerCase()))
      if (found) return found
    }
  } catch (error) {
    console.error('Directus lookup failed for farm:', error)
  }
  return null
}

const microplasticData = computed(() => {
  const f = farm.value || {}
  return {
    fragments: Number(f.fragment_count || 0),
    fibers: Number(f.fiber_count || 0),
    foams: Number(f.foam_count || 0),
    films: Number(f.film_count || 0),
    sheets: Number(f.sheets_count || f.sheet_count || f.sheets || 0),
    pellets: Number(f.beads_count || 0),
  }
})

// use global selection from app store for cross-page persistence
function handleDonutSelection(key) {
  app.toggleSelectedMorphology(key)
}

const mpColors = {
  fragments: '#0B2E4E',
  fibers: '#19568E',
  films: '#63B3FF',
  foams: '#4688C7',
  sheets: '#8FD3C7',
  pellets: '#B9DDFF',
}

// Prefer comparing the current site to other sites with the same cultivation practice.
// If the current farm has no recorded practice or no matches are found, fall back to
// using all sites so the comparison still renders.
const sitesOfSamePractice = computed(() => {
  if (comparisonSites.value && Array.isArray(comparisonSites.value) && comparisonSites.value.length > 0) {
    const arr = comparisonSites.value.slice()
    const fid = farm.value?.id
    if (fid && !arr.some(s => s.id === fid)) {
      const ffull = sites.find(s => s.id === fid)
      if (ffull) arr.unshift(ffull)
    }
    return arr
  }

  const practiceRaw = farm.value?.cultivation_practice
  const practice = practiceRaw ? String(practiceRaw).toLowerCase().trim() : ''
  let arr = []
  if (practice) {
    arr = (sites || []).filter(s => (s.cultivation_practice || '').toString().toLowerCase().includes(practice))
  }
  if (!arr || arr.length === 0) arr = sites || []

  const fid = farm.value?.id
  if (fid && !arr.some(s => s.id === fid)) {
    const ffull = sites.find(s => s.id === fid)
    if (ffull) arr.unshift(ffull)
  }
  return arr
})

const anonymizedComparison = computed(() => {
  const list = sitesOfSamePractice.value || []
  const categories = []
  const totals = []
  const drilldown = []
  let anonIdx = 0
  for (const s of list) {
    const total = (s.fragment_count || 0) + (s.fiber_count || 0) + (s.foam_count || 0) + (s.film_count || 0) + (s.sheets_count || s.sheet_count || s.sheets || 0) + (s.beads_count || 0)
    totals.push(total)
    drilldown.push([s.fragment_count || 0, s.fiber_count || 0, s.foam_count || 0, s.film_count || 0, s.sheets_count || s.sheet_count || s.sheets || 0, s.beads_count || 0])
    if (s.id === farm.value?.id) {
      categories.push(s.site_name || 'This Site')
    } else {
      const letter = String.fromCodePoint(65 + (anonIdx % 26))
      categories.push(`Site ${letter}`)
      anonIdx++
    }
  }
  return { categories, totals, drilldown }
})

const colorBuckets = ['Gray', 'Blue', 'White', 'Transparent', 'Black', 'Green']
const colorBucketRatios = [0.35, 0.3, 0.2, 0.15]

const farmTotalMP = computed(() => {
  const d = microplasticData.value
  return (d.fragments || 0) + (d.fibers || 0) + (d.foams || 0) + (d.films || 0) + (d.sheets || 0) + (d.pellets || 0)
})

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

async function fetchColorComparisonForFarm(farmId) {
  colorComparisonFetched.value = null
  if (!farmId) return null
  colorComparisonLoading.value = true
  try {
    const resp = await directus.request(readItems('microplastics', { filter: { sample_source: { site: { _eq: farmId } } }, limit: -1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    if (!items || items.length === 0) return null

    const normalizeRaw = s => (s || '').toString().trim()
    const normKey = s => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9#\s]/g, '') || 'unknown'

    const counts = new Map()
    for (const it of items) {
      const rawColor = it.color || it.color_bucket || it.colour || ''
      const norm = normKey(rawColor)
      if (!counts.has(norm)) counts.set(norm, { count: 0, raws: new Map(), drilldown: [0, 0, 0, 0, 0, 0] })
      const obj = counts.get(norm)
      // support per-record numeric counts if present (e.g. particle_count, count, quantity)
      const sampleCount = Number(it.count || it.particle_count || it.quantity || it.number || it.num_particles || it.particle_count_per_sample || 1)
      obj.count += sampleCount
      obj.raws.set(normalizeRaw(rawColor), (obj.raws.get(normalizeRaw(rawColor)) || 0) + sampleCount)

      const morph = it.shape || it.morphology || it.mp_category || it.type
      const idx = morphologyIndex(morph)
      if (idx >= 0) {
        obj.drilldown[idx] = (obj.drilldown[idx] || 0) + sampleCount
      } else {
        // track unknown morphology cases for debugging
        obj.unknown = (obj.unknown || 0) + 1
        obj.unknownSamples = obj.unknownSamples || []
        try {
          obj.unknownSamples.push({ id: it.id, shape: it.shape, morphology: morph, mp_category: it.mp_category, type: it.type, sampleCount })
        } catch {
          // ignore push errors
        }
      }
    }

    // (removed debug logging)

    const arr = Array.from(counts.entries()).map(([norm, v]) => {
      const topRaw = Array.from(v.raws.entries()).toSorted((a, b) => b[1] - a[1])[0]?.[0] || norm
      const display = String(topRaw).trim().startsWith('#') ? topRaw.trim() : topRaw.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
      return { norm, display, count: v.count, drilldown: v.drilldown, unknown: v.unknown || 0, unknownSamples: v.unknownSamples || [] }
    }).toSorted((a, b) => b.count - a.count)

    const topN = 6
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

    // Fallback: some color groups may have samples with missing/undefined morphology
    // In that case, the drilldown array will sum to less than the color total. To avoid
    // showing zeros for the drilldown, distribute the missing samples proportionally
    // according to the farm's overall morphology distribution (microplasticData).
    try {
      const mp = microplasticData.value || { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0, pellets: 0 }
      const mpVals = [mp.fragments || 0, mp.fibers || 0, mp.foams || 0, mp.films || 0, mp.sheets || 0, mp.pellets || 0]
      const mpTotal = farmTotalMP.value || mpVals.reduce((a, b) => a + b, 0)
      if (mpTotal > 0) {
        for (const e of explicit) {
          const dd = e.drilldown || [0, 0, 0, 0, 0, 0]
          const sumDd = dd.reduce((a, b) => a + (Number(b) || 0), 0)
          if ((e.count || 0) > 0 && sumDd < e.count) {
            let missing = (e.count || 0) - sumDd
            // distribute floor(missing * fraction) to each bucket, keep remainder
            for (let j = 0; j < 6 && missing > 0; j++) {
              const share = Math.floor(missing * ((mpVals[j] || 0) / mpTotal))
              if (share > 0) {
                dd[j] = (dd[j] || 0) + share
                missing -= share
              }
            }
            // if any remainder left, assign to the largest farm morphology bucket
            if (missing > 0) {
              let maxIdx = 0
              for (let k = 1; k < 6; k++) if ((mpVals[k] || 0) > (mpVals[maxIdx] || 0)) maxIdx = k
              dd[maxIdx] = (dd[maxIdx] || 0) + missing
              missing = 0
            }
            e.drilldown = dd
          }
        }
      }
    } catch (error) {
      // don't break on fallback failures
      console.warn('[fetchColorComparisonForFarm] morphology fallback failed', error)
    }

    // (removed debug reporting)

    colorComparisonFetched.value = { categories, totals, drilldown, overviewColors: colorsArr }
    return colorComparisonFetched.value
  } catch (error) {
    console.error('Error fetching microplastics for color comparison', error)
    colorComparisonFetched.value = null
    return null
  } finally {
    colorComparisonLoading.value = false
  }
}

const colorComparison = computed(() => {
  if (colorComparisonFetched.value) return colorComparisonFetched.value
  const totals = colorBucketRatios.map(r => Math.round((farmTotalMP.value || 0) * r))
  const mp = microplasticData.value
  const mpTotal = farmTotalMP.value || 0
  const drilldown = totals.map(t => {
    if (mpTotal === 0 || t === 0) return [0, 0, 0, 0, 0, 0]
    const fragments = Math.round(t * ((mp.fragments || 0) / mpTotal))
    const fibers = Math.round(t * ((mp.fibers || 0) / mpTotal))
    const foams = Math.round(t * ((mp.foams || 0) / mpTotal))
    const films = Math.round(t * ((mp.films || 0) / mpTotal))
    const sheets = Math.round(t * ((mp.sheets || 0) / mpTotal))
    const pellets = Math.max(0, t - (fragments + fibers + foams + films + sheets))
    return [fragments, fibers, foams, films, sheets, pellets]
  })
  const known = { gray: '#9e9e9e', blue: '#1976d2', white: '#ffffff', transparent: '#cfd8dc', black: '#000000', green: '#2E7D32' }
  const overviewColors = colorBuckets.map(label => {
    const key = (label || '').toString().toLowerCase()
    if (known[key]) return known[key]
    let h = 0
    for (let i = 0; i < label.length; i++) h = (h * 31 + (label.codePointAt(i) || 0)) % 360
    return `hsl(${h},60%,45%)`
  })
  return { categories: colorBuckets, totals, drilldown, overviewColors }
})

const sizeRanges = ['1-20 µm', '20-100 µm', '100-500 µm', '500 µm-1 mm', '1-5 mm']
const sizeRatios = [0.12, 0.28, 0.35, 0.15, 0.1]
const _sizeComparison = computed(() => {
  const totals = sizeRatios.map(r => Math.round((farmTotalMP.value || 0) * r))
  const mp = microplasticData.value
  const mpTotal = farmTotalMP.value || 0
  const drilldown = totals.map(t => {
    if (mpTotal === 0 || t === 0) return [0, 0, 0, 0, 0, 0]
    const fragments = Math.round(t * ((mp.fragments || 0) / mpTotal))
    const fibers = Math.round(t * ((mp.fibers || 0) / mpTotal))
    const foams = Math.round(t * ((mp.foams || 0) / mpTotal))
    const films = Math.round(t * ((mp.films || 0) / mpTotal))
    const sheets = Math.round(t * ((mp.sheets || 0) / mpTotal))
    const pellets = Math.max(0, t - (fragments + fibers + foams + films + sheets))
    return [fragments, fibers, foams, films, sheets, pellets]
  })
  return { categories: sizeRanges, totals, drilldown }
})

watch(farmParam, async () => {
  farm.value = await fetchFarmFromDirectus(farmParam.value)
}, { immediate: true })

watch(farm, async newFarm => {
  if (newFarm?.id) {
    app.startLoading()
    try {
      await fetchLatestSampleDateForFarm(newFarm.id)
      await fetchColorComparisonForFarm(newFarm.id)
      try {
        comparisonSites.value = await fetchSitesByPractice(newFarm.cultivation_practice)
      } catch {
        comparisonSites.value = null
      }
    } finally {
      app.finishLoading()
    }
  } else {
    latestSampleDate.value = null
    colorComparisonFetched.value = null
    comparisonSites.value = null
  }
}, { immediate: true })

onMounted(() => { })

function printReport() {
  window.print()
}

async function fetchLatestSampleDateForFarm(farmId) {
  latestSampleDate.value = null
  if (!farmId) return null
  try {
    const resp = await directus.request(readItems('soilsamples', { filter: { site: { _eq: farmId } }, sort: ['-date_collected'], limit: 1 }))
    const items = Array.isArray(resp) ? resp : (resp?.data || [])
    const sample = (items && items[0]) || null
    latestSampleDate.value = sample?.date_collected || null
  } catch (error) {
    console.error('Error fetching latest soilsample for farm', farmId, error)
    latestSampleDate.value = null
  }
  return latestSampleDate.value
}
</script>

<template>
  <div class="insight-page">
    <div class="d-flex align-center justify-space-between mb-8">
      <div class="d-flex flex-column">
        <div class="d-flex align-center">
          <VIcon color="grey" size="x-large" style="cursor:pointer; vertical-align:middle;" @click="$router.back()">
            mdi-menu-left</VIcon>
          <h1 class="title mb-0">{{ farm?.site_name }}</h1>
        </div>
        <p class="text-h5 ml-8">{{ farm?.address }}</p>
      </div>
      <div class="d-flex align-center justify-center bg-blue pa-4 px-6 rounded-lg cursor-pointer"
        style=" box-shadow: 0 1px 6px rgba(0, 0, 0, .06);" @click="printReport">
        <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
        <p class="text-h4 text-white font-weight-bold">Print Report</p>
      </div>
    </div>
    <VRow>
      <VCol cols="4">
        <div class="card">
          <h3 class="text-h5 font-weight-bold">Geographic Location</h3>
          <p class="mb-2">{{ farm?.latitude }}, {{ farm?.longitude }}</p>
          <div v-if="farm?.latitude != null && farm?.longitude != null" class="map-wrapper">
            <LeafletMap :lat="farm?.latitude != null ? Number(farm.latitude) : null"
              :lng="farm?.longitude != null ? Number(farm.longitude) : null" :zoom="13" />
          </div>
          <div v-else class="card">
            <p>No coordinates available for this farm.</p>
          </div>
        </div>
      </VCol>
      <VCol cols="5">
        <VRow>
          <VCol cols="8">
            <div class="card">
              <h3 class="text-h5 font-weight-bold mb-4">{{ titleCase(farm?.cultivation_practice) }}
                Farming</h3>
              <p>{{ getCultivationDefinition(farm?.cultivation_practice) }}</p>
              <div class="card-footer">
                <a :href="`https://www.google.com/search?q=${encodeURIComponent((farm?.cultivation_practice) ? farm.cultivation_practice + ' cultivation practice' : 'cultivation practice')}`"
                  target="_blank" rel="noopener noreferrer" class="learn-more">
                  <VIcon size="small" class="mr-2">mdi-open-in-new</VIcon>
                  Learn more
                </a>
              </div>
            </div>
          </VCol>
          <VCol cols="4">
            <div class="card">
              <h3 class="text-h5 font-weight-bold mb-4">Crops Grown</h3>
              <div class="crops-list">
                <ul>
                  <li v-for="(crop, index) in farm?.crops" :key="index">{{ titleCase(crop) }}</li>
                </ul>
              </div>
            </div>
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="4">
            <div class="card">
              <h3 class="text-h6 font-weight-bold text-center">Land Area </h3>
              <p class="text-h3 font-weight-bold text-center">{{ farm?.land_area_ha }}</p>
              <p class="text-h5 font-weight-bold text-center">hectares</p>
            </div>
          </VCol>
          <VCol cols="4">
            <div class="card">
              <h3 class="text-h6 font-weight-bold text-center">Water Source</h3>
              <div class="icon-container bg-blue">
                <VIcon color="white" size="x-large">{{ waterIcon }}</VIcon>
              </div>
              <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm?.water_source) }}
              </p>
            </div>
          </VCol>
          <VCol cols="4">
            <div class="card">
              <h3 class="text-h6 font-weight-bold text-center">Soil Texture</h3>
              <div class="icon-container bg-brown">
                <VIcon color="white" size="x-large">mdi-image-filter-hdr</VIcon>
              </div>
              <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm?.soil_type) }}</p>
            </div>
          </VCol>
        </VRow>
      </VCol>
      <VCol cols="3">
        <div class="card">
          <h3 class="text-h5 font-weight-bold mb-4">Plastic-Related Activities</h3>
          <!-- Template for each item in Plastic Activity List check if the farm does it -->
          <template v-for="activity in plasticActivityList" :key="activity">
            <div class="d-flex align-center justify-space-between mb-2">
              <p>{{ activity }}</p>
              <VIcon :color="farmHasActivity(activity) ? 'green' : 'red'" size="large">
                {{ farmHasActivity(activity) ? 'mdi-check-circle' :
                  'mdi-close-circle' }}
              </VIcon>
            </div>
            <div class="horizontal-bar" />
          </template>
        </div>
      </VCol>
    </VRow>
    <VRow>
      <VCol cols="5">
        <div class="d-flex flex-column ga-4">
          <div class="card">
            <MPDonutChart :date="displaySampleDate" :microplastic-data="microplasticData"
              :active-key="app.selectedMorphology" @selection="handleDonutSelection" />
          </div>
          <div class="card">
            <SiteDrilldownChart :categories="anonymizedComparison.categories"
              :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
              :date="displaySampleDate" :drilldown="anonymizedComparison.drilldown" :height="320"
              :title="farm?.cultivation_practice ? `Contamination Comparison to Other ${titleCase(farm?.cultivation_practice)} Farms` : 'Contamination Comparison to Other Farms'"
              :totals="anonymizedComparison.totals" :filter-key="app.selectedMorphology" />
          </div>
          <div class="card">
            <div class="d-flex align-center mb-1"
              style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center;">
                <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">
                  AI Summary
                </h4>
                <VIcon class="ml-2" color="primary" size="small">mdi-creation</VIcon>
              </div>
              <p class="subtitle mb-0">{{ displaySampleDate }}</p>
            </div>
            <div class="summary-box">
              <p class="preserve-newlines">{{ aiSummaryText }}</p>
            </div>
          </div>
        </div>
      </VCol>
      <VCol cols="7">
        <div class="d-flex flex-column ga-4">
          <MonthlyTrendChart :date="displaySampleDate" :height="320" :site-id="farm?.id"
            :title="`Monthly Microplastic Trend for ${farm?.site_name}`" :filter-key="app.selectedMorphology" />
          <div class="card">
            <template v-if="colorComparisonLoading">
              <div :style="{ minHeight: '260px', display: 'flex', justifyContent: 'center', alignItems: 'center' }">
                <VProgressCircular color="primary" indeterminate size="28" />
              </div>
            </template>
            <template v-else>
              <SiteDrilldownChart :categories="colorComparison.categories"
                :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets', 'Pellets']" :colors="mpColors"
                :date="displaySampleDate" :drilldown="colorComparison.drilldown" :height="260"
                title="Microplastic Count by Color" :totals="colorComparison.totals"
                :filter-key="app.selectedMorphology" />
            </template>
          </div>
          <div class="card">
            <MPSizeRangeChart :date="displaySampleDate" :height="260" :site-id="farm?.id"
              title="Microplastic Count by Size Range" :filter-key="app.selectedMorphology" />
          </div>
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

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
  height: 100%;
}

/* Make cards stack vertically and allow a map area to grow */
.card {
  display: flex;
  flex-direction: column;
}

.horizontal-bar {
  height: 1px;
  background-color: #e0e0e0;
  margin-top: 8px;
  margin-bottom: 12px;
}

.crops-list {
  max-height: 70px;
  overflow-y: auto;
}

.icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  margin: 0 auto 0px auto;
}

.summary-box {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 6px;
  margin-top: 10px;
  max-height: 180px;
  overflow-y: auto;
}

.preserve-newlines {
  white-space: pre-wrap;
}

.subtitle {
  color: rgb(155, 155, 155);
}

.card-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.learn-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1976d2;
  font-weight: 600;
  text-decoration: none;
}

.learn-more:hover {
  text-decoration: underline;
}

/* Map wrapper stretches to fill remaining card space */
.map-wrapper {
  flex: 1 1 auto;
  min-height: 140px;
  margin-top: 8px;
}

/* Ensure the leaflet/map component fills the wrapper
   (Leaflet's container usually uses .leaflet-container but the component
   may render a root element; this covers both cases) */
.map-wrapper, .map-wrapper > * {
  height: 100%;
}
.map-wrapper .leaflet-container {
  height: 100% !important;
}
</style>
