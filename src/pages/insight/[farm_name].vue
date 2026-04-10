<script setup>
  import { readItems } from '@directus/sdk'
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import AISummary from '@/components/AISummary.vue'
  import BiologicalRiskChart from '@/components/graphs/BiologicalRiskChart.vue'
  import MonthlyTrendChart from '@/components/graphs/MonthlyTrendChart.vue'
  import MPDonutChart from '@/components/graphs/MPDonutChart.vue'
  import MPSizeRangeChart from '@/components/graphs/MPSizeRangeChart.vue'
  import SiteDrilldownChart from '@/components/graphs/SiteDrilldownChart.vue'
  import SourceDegradationIndex from '@/components/graphs/SourceDegradationIndex.vue'

  // Directus helper
  import directus from '@/composables/useDirectus'
  import useLatestSampleDate from '@/composables/useLatestSampleDate.js'

  import { CHART_COLORS, MP_COLOR_MAP } from '@/config/chartPalette.js'
  import { MP_SIZE_BUCKETS } from '@/config/constants.js'

  import { useAppStore } from '@/stores/app'
  import LeafletMap from '../../components/LeafletMap.vue'

  // Routing / params
  const route = useRoute()
  const farmParam = computed(() => route.params.farm_name || '')

  // Local cache of sites (kept as a simple array for lookups)
  const sites = []
  const comparisonSites = ref(null)

  // Primary reactive state
  const farm = ref(null)
  const farmNotFound = ref(false)
  const latestSampleDate = ref(null)
  const colorComparisonFetched = ref(null)
  const colorComparisonLoading = ref(false)
  const sizeComparisonData = ref(null)
  const sizeComparisonLoading = ref(false)
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
    'Fertilizer Sacks',
    'Plastic Mulching',
    'Seedling Trays',
    'Compost with Plastic',
    'Greenhouse Plastic Sheet',
  ]

  const cultivationDefinitions = {
    'Fully Organic': 'An agricultural practice that avoids synthetic chemicals and fertilizers, relying on natural processes and materials to maintain soil fertility, manage pests, and promote ecosystem health.',
    'Integrated': 'A sustainable farming approach that combines biological, cultural, mechanical, and chemical methods in a balanced way to optimize crop production while minimizing environmental impact.',
    'Conventional': 'A traditional farming method that typically relies on synthetic fertilizers, pesticides, and other chemicals to maximize crop yields, often with less emphasis on ecological sustainability.',
  }

  function getCultivationDefinition (practice) {
    if (!practice) return ''
    if (cultivationDefinitions[practice]) return cultivationDefinitions[practice]
    const p = String(practice).toLowerCase()
    if (p.includes('organic')) return cultivationDefinitions['Fully Organic']
    if (p.includes('integrated')) return cultivationDefinitions['Integrated']
    if (p.includes('conventional')) return cultivationDefinitions['Conventional']
    return ''
  }

  function slugify (str) {
    if (!str) return ''
    return String(str).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
  }

  function normalizeActivityName (s) {
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

  function farmHasActivity (activity) {
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

  function titleCaseString (s) {
    if (s == null) return ''
    const str = String(s).toLowerCase()
    return str.split(/(\s|\-)/).map(part => {
      if (/^\s|\-$/g.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    }).join('')
  }

  function titleCase (val) {
    if (val == null) return ''
    return Array.isArray(val) ? val.map(v => titleCaseString(v)).join(', ') : titleCaseString(val)
  }

  async function fetchSitesByPractice (practice) {
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

  async function fetchFarmFromDirectus (param) {
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
        const key = slugify(decoded)
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
    // pellets (beads_count) removed from display categories
    }
  })

  // use global selection from app store for cross-page persistence
  function handleDonutSelection (key) {
    app.toggleSelectedMorphology(key)
  }
  const mpColors = { ...MP_COLOR_MAP }

  // Prefer comparing the current site to other sites with the same cultivation practice.
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
      const total = (s.fragment_count || 0) + (s.fiber_count || 0) + (s.foam_count || 0) + (s.film_count || 0) + (s.sheets_count || s.sheet_count || s.sheets || 0)
      totals.push(total)
      drilldown.push([s.fragment_count || 0, s.fiber_count || 0, s.foam_count || 0, s.film_count || 0, s.sheets_count || s.sheet_count || s.sheets || 0])
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
    return (d.fragments || 0) + (d.fibers || 0) + (d.foams || 0) + (d.films || 0) + (d.sheets || 0)
  })

  function morphologyIndex (morph) {
    const m = (morph || '').toString().toLowerCase()
    if (m.includes('fragment')) return 0
    if (m.includes('fiber') || m.includes('fibre')) return 1
    if (m.includes('foam')) return 2
    if (m.includes('film')) return 3
    if (m.includes('sheet')) return 4
    // pellets/beads are no longer a displayed category
    return -1
  }

  async function fetchColorComparisonForFarm (farmId) {
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
        // support per-record numeric counts
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

      const known = { gray: '#9e9e9e', grey: '#9e9e9e', blue: CHART_COLORS[0], white: '#ffffff', transparent: '#cfd8dc', black: '#000000', green: CHART_COLORS[1] }
      const colorsArr = categories.map(label => {
        const key = (label || '').toString().toLowerCase()
        if (known[key]) return known[key]
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(label)) return label
        let h = 0
        for (let i = 0; i < label.length; i++) h = (h * 31 + (label.codePointAt(i) || 0)) % 360
        return `hsl(${h},60%,45%)`
      })

      // Fallback: fill missing drilldown data proportionally (pellets omitted)
      try {
        const mp = microplasticData.value || { fragments: 0, fibers: 0, foams: 0, films: 0, sheets: 0 }
        const mpVals = [mp.fragments || 0, mp.fibers || 0, mp.foams || 0, mp.films || 0, mp.sheets || 0]
        const mpTotal = farmTotalMP.value || mpVals.reduce((a, b) => a + b, 0)
        if (mpTotal > 0) {
          for (const e of explicit) {
            const dd = e.drilldown || [0, 0, 0, 0, 0]
            const sumDd = dd.reduce((a, b) => a + (Number(b) || 0), 0)
            if ((e.count || 0) > 0 && sumDd < e.count) {
              let missing = (e.count || 0) - sumDd
              for (let j = 0; j < 5 && missing > 0; j++) {
                const share = Math.floor(missing * ((mpVals[j] || 0) / mpTotal))
                if (share > 0) {
                  dd[j] = (dd[j] || 0) + share
                  missing -= share
                }
              }
              if (missing > 0) {
                let maxIdx = 0
                for (let k = 1; k < 5; k++) if ((mpVals[k] || 0) > (mpVals[maxIdx] || 0)) maxIdx = k
                dd[maxIdx] = (dd[maxIdx] || 0) + missing
                missing = 0
              }
              e.drilldown = dd
            }
          }
        }
      } catch (error) {
        console.warn('[fetchColorComparisonForFarm] morphology fallback failed', error)
      }

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
      if (mpTotal === 0 || t === 0) return [0, 0, 0, 0, 0]
      const fragments = Math.round(t * ((mp.fragments || 0) / mpTotal))
      const fibers = Math.round(t * ((mp.fibers || 0) / mpTotal))
      const foams = Math.round(t * ((mp.foams || 0) / mpTotal))
      const films = Math.round(t * ((mp.films || 0) / mpTotal))
      const sheets = Math.round(t * ((mp.sheets || 0) / mpTotal))
      return [fragments, fibers, foams, films, sheets]
    })
    const known = { gray: '#9e9e9e', blue: CHART_COLORS[0], white: '#ffffff', transparent: '#cfd8dc', black: '#000000', green: CHART_COLORS[1] }
    const overviewColors = colorBuckets.map(label => {
      const key = (label || '').toString().toLowerCase()
      if (known[key]) return known[key]
      let h = 0
      for (let i = 0; i < label.length; i++) h = (h * 31 + (label.codePointAt(i) || 0)) % 360
      return `hsl(${h},60%,45%)`
    })
    return { categories: colorBuckets, totals, drilldown, overviewColors }
  })

  watch(farmParam, async () => {
    farmNotFound.value = false
    farm.value = await fetchFarmFromDirectus(farmParam.value)
    if (!farm.value) {
      farmNotFound.value = true
    }
  }, { immediate: true })

  watch(farm, async newFarm => {
    if (newFarm?.id) {
      app.startLoading()
      try {
        await fetchLatestSampleDateForFarm(newFarm.id)
        await fetchColorComparisonForFarm(newFarm.id)
        await fetchSizeComparisonForFarm(newFarm.id)
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
      sizeComparisonData.value = null
      comparisonSites.value = null
    }
  }, { immediate: true })

  function printReport () {
    window.print()
  }

  async function fetchLatestSampleDateForFarm (farmId) {
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

  function bucketForDiameter (val) {
    if (!Number.isFinite(val)) return -1
    if (val >= 1 && val < 20) return 0 // '1-20 µm'
    if (val >= 20 && val < 100) return 1 // '20-100 µm'
    if (val >= 100 && val < 500) return 2 // '100-500 µm'
    if (val >= 500 && val < 1000) return 3 // '500 µm-1 mm'
    if (val >= 1000 && val <= 5000) return 4 // '1-5 mm'
    return -1
  }

  async function fetchSizeComparisonForFarm (farmId) {
    sizeComparisonData.value = null
    if (!farmId) return null
    sizeComparisonLoading.value = true
    try {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 24)
      const cutoffIso = cutoff.toISOString()
      const resp = await directus.request(readItems('microplastics', {
        filter: {
          sample_source: {
            site: { _eq: farmId },
            date_collected: { _gte: cutoffIso },
          },
        },
        limit: -1,
      }))
      const items = Array.isArray(resp) ? resp : (resp?.data || [])

      const sizeBuckets = MP_SIZE_BUCKETS

      const counts = Array.from({ length: sizeBuckets.length }, () => 0)
      const drilldown = Array.from({ length: sizeBuckets.length }, () => [0, 0, 0, 0, 0])

      for (const item of items) {
        const diameter = Number(item.equivalent_circular_diameter_um)
        if (!Number.isFinite(diameter)) continue

        const bucketIdx = bucketForDiameter(diameter)
        if (bucketIdx < 0) continue

        const sampleCount = Number(item.count || item.particle_count || item.quantity || 1)
        counts[bucketIdx] += sampleCount

        const morph = item.shape || item.morphology || item.mp_category || item.type
        const morphIdx = morphologyIndex(morph)
        if (morphIdx >= 0) {
          drilldown[bucketIdx][morphIdx] += sampleCount
        }
      }

      sizeComparisonData.value = {
        categories: sizeBuckets.map(b => b.label),
        totals: counts,
        drilldown: drilldown,
      }

      return sizeComparisonData.value
    } catch (error) {
      console.error('Error fetching size comparison for farm', farmId, error)
      sizeComparisonData.value = null
      return null
    } finally {
      sizeComparisonLoading.value = false
    }
  }

  const biologicalRiskData = computed(() => {
    const sizes = sizeComparisonData.value
    if (!sizes || !sizes.categories || !sizes.totals) return []

    const findTotal = label => {
      const idx = sizes.categories.findIndex(c => (c || '').toString().toLowerCase() === label)
      return idx === -1 ? 0 : (sizes.totals[idx] || 0)
    }

    const lt100 = findTotal('1-20 µm'.toLowerCase()) + findTotal('20-100 µm'.toLowerCase())
    const between100_500 = findTotal('100-500 µm'.toLowerCase())
    const gt1mm = findTotal('1-5 mm'.toLowerCase())

    return [
      { category: '< 100 µm', count: lt100 },
      { category: '100-500 µm', count: between100_500 },
      { category: '> 1 mm', count: gt1mm },
    ]
  })

  const farmAsArray = computed(() => farm.value ? [farm.value] : [])
</script>

<template>
  <div class="insight-page">
    <ErrorBanner
      v-if="farmNotFound"
      :message="`Farm '${farmParam}' could not be found. It may have been removed or the name is incorrect.`"
      @retry="$router.back()"
    />

    <template v-if="!farmNotFound">
      <!-- Header -->
      <div class="d-flex align-center justify-space-between mb-8">
        <div class="d-flex flex-column">
          <div class="d-flex align-center">
            <VBtn
              aria-label="Go back"
              color="grey"
              icon
              variant="text"
              @click="$router.back()"
            >
              <VIcon size="x-large">mdi-menu-left</VIcon>
            </VBtn>
            <VSkeletonLoader v-if="!farm" type="heading" width="300" />
            <h1 v-else class="title mb-0">{{ farm.site_name }}</h1>
          </div>
          <VSkeletonLoader v-if="!farm" class="ml-8 mt-1" type="text" width="200" />
          <p v-else class="text-h5 ml-8">{{ farm.address }}</p>
        </div>
        <VSkeletonLoader v-if="!farm" height="60" type="button" width="160" />
        <div
          v-else
          aria-label="Print report"
          class="d-flex align-center justify-center bg-blue pa-4 px-6 rounded-lg cursor-pointer"
          role="button"
          style="box-shadow: 0 1px 6px rgba(0, 0, 0, .06);"
          tabindex="0"
          @click="printReport"
          @keydown.enter="printReport"
          @keydown.space.prevent="printReport"
        >
          <VIcon color="white" size="x-large">mdi-note-text-outline</VIcon>
          <p class="text-h4 text-white font-weight-bold">Print Report</p>
        </div>
      </div>

      <!-- Row 1: location / farm info / activities -->
      <VRow>
        <VCol cols="4">
          <div class="card">
            <VSkeletonLoader v-if="!farm" type="heading, image" />
            <template v-else>
              <h3 class="text-h5 font-weight-bold">Geographic Location</h3>
              <p class="mb-2">{{ farm.latitude }}, {{ farm.longitude }}</p>
              <div v-if="farm.latitude != null && farm.longitude != null" class="map-wrapper">
                <LeafletMap :lat="Number(farm.latitude)" :lng="Number(farm.longitude)" :zoom="13" />
              </div>
              <div v-else class="card">
                <p>No coordinates available for this farm.</p>
              </div>
            </template>
          </div>
        </VCol>
        <VCol cols="5">
          <VRow>
            <VCol cols="8">
              <div class="card">
                <VSkeletonLoader v-if="!farm" type="article" />
                <template v-else>
                  <h3 class="text-h5 font-weight-bold mb-4">{{ titleCase(farm.cultivation_practice) }} Farming</h3>
                  <p>{{ getCultivationDefinition(farm.cultivation_practice) }}</p>
                  <div class="card-footer">
                    <a
                      class="learn-more"
                      :href="`https://www.google.com/search?q=${encodeURIComponent(farm.cultivation_practice ? farm.cultivation_practice + ' cultivation practice' : 'cultivation practice')}`"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <VIcon class="mr-2" size="small">mdi-open-in-new</VIcon>
                      Learn more
                    </a>
                  </div>
                </template>
              </div>
            </VCol>
            <VCol cols="4">
              <div class="card">
                <VSkeletonLoader v-if="!farm" type="list-item-two-line@3" />
                <template v-else>
                  <h3 class="text-h5 font-weight-bold mb-4">Crops Grown</h3>
                  <div class="crops-list">
                    <ul>
                      <li v-for="(crop, index) in farm.crops" :key="index">{{ titleCase(crop) }}</li>
                    </ul>
                  </div>
                </template>
              </div>
            </VCol>
          </VRow>
          <VRow>
            <VCol cols="4">
              <div class="card">
                <VSkeletonLoader v-if="!farm" type="heading, subtitle" />
                <template v-else>
                  <h3 class="text-h6 font-weight-bold text-center">Land Area</h3>
                  <p class="text-h3 font-weight-bold text-center">{{ farm.land_area_ha }}</p>
                  <p class="text-h5 font-weight-bold text-center">hectares</p>
                </template>
              </div>
            </VCol>
            <VCol cols="4">
              <div class="card">
                <VSkeletonLoader v-if="!farm" type="heading, avatar, subtitle" />
                <template v-else>
                  <h3 class="text-h6 font-weight-bold text-center">Water Source</h3>
                  <div class="icon-container bg-blue">
                    <VIcon color="white" size="x-large">{{ waterIcon }}</VIcon>
                  </div>
                  <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm.water_source) }}</p>
                </template>
              </div>
            </VCol>
            <VCol cols="4">
              <div class="card">
                <VSkeletonLoader v-if="!farm" type="heading, avatar, subtitle" />
                <template v-else>
                  <h3 class="text-h6 font-weight-bold text-center">Soil Texture</h3>
                  <div class="icon-container bg-brown">
                    <VIcon color="white" size="x-large">mdi-image-filter-hdr</VIcon>
                  </div>
                  <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm.soil_type) }}</p>
                </template>
              </div>
            </VCol>
          </VRow>
        </VCol>
        <VCol cols="3">
          <div class="card">
            <VSkeletonLoader v-if="!farm" type="list-item-two-line@5" />
            <template v-else>
              <h3 class="text-h5 font-weight-bold mb-4">Plastic-Related Activities</h3>
              <template v-for="activity in plasticActivityList" :key="activity">
                <div class="d-flex align-center justify-space-between mb-2">
                  <p>{{ activity }}</p>
                  <VIcon :color="farmHasActivity(activity) ? 'green' : 'red'" size="large">
                    {{ farmHasActivity(activity) ? 'mdi-check-circle' : 'mdi-close-circle' }}
                  </VIcon>
                </div>
                <div class="horizontal-bar" />
              </template>
            </template>
          </div>
        </VCol>
      </VRow>

      <!-- Row 2: charts -->
      <VRow>
        <VCol cols="4">
          <div class="d-flex flex-column ga-4">
            <div class="card">
              <VSkeletonLoader v-if="!farm" height="300" type="image" />
              <MPDonutChart
                v-else
                :active-key="app.selectedMorphology"
                :date="displaySampleDate"
                :microplastic-data="microplasticData"
                @selection="handleDonutSelection"
              />
            </div>
            <div class="card">
              <VSkeletonLoader v-if="!farm || colorComparisonLoading" height="250" type="image" />
              <SiteDrilldownChart
                v-else
                :categories="anonymizedComparison.categories"
                :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
                :colors="mpColors"
                :date="displaySampleDate"
                :drilldown="anonymizedComparison.drilldown"
                :filter-key="app.selectedMorphology"
                :height="250"
                :title="farm.cultivation_practice ? `Contamination Comparison to Other ${titleCase(farm.cultivation_practice)} Farms` : 'Contamination Comparison to Other Farms'"
                :totals="anonymizedComparison.totals"
              />
            </div>
          </div>
        </VCol>
        <VCol cols="8">
          <div class="d-flex flex-column ga-4">
            <VSkeletonLoader v-if="!farm" height="320" type="image" />
            <MonthlyTrendChart
              v-else
              :date="displaySampleDate"
              :filter-key="app.selectedMorphology"
              :height="320"
              :site-id="farm.id"
              :title="`Monthly Microplastic Trend for ${farm.site_name}`"
            />

            <VRow>
              <VCol cols="5">
                <div class="card">
                  <VSkeletonLoader v-if="!farm" height="260" type="image" />
                  <SourceDegradationIndex v-else :height="260" :sites="farmAsArray" />
                </div>
              </VCol>
              <VCol cols="7">
                <div class="card">
                  <VSkeletonLoader v-if="!farm || sizeComparisonLoading" height="260" type="image" />
                  <BiologicalRiskChart v-else :data="biologicalRiskData" :height="260" :loading="false" />
                </div>
              </VCol>
            </VRow>
          </div>
        </VCol>
      </VRow>

      <!-- Row 3: AI summary -->
      <VRow>
        <VCol cols="12">
          <div class="card">
            <VSkeletonLoader v-if="!farm" type="article" />
            <AISummary
              v-else
              :is-overview="false"
              :item="farm"
              :max-height="'200px'"
              :title="'AI Diagnosis'"
            />
          </div>
        </VCol>
      </VRow>
    </template>
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
  color: #366ECE;
  font-weight: 600;
  text-decoration: none;
}

.learn-more:hover {
  text-decoration: underline;
}

.map-wrapper {
  flex: 1 1 auto;
  min-height: 140px;
  margin-top: 8px;
}

.map-wrapper,
.map-wrapper>* {
  height: 100%;
}

.map-wrapper .leaflet-container {
  height: 100% !important;
}
</style>
