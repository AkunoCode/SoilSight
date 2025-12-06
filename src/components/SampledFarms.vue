<script setup>
import { computed, defineProps, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CHART_COLORS } from '@/config/chartPalette'

const props = defineProps({
  sampledSites: { type: Array, default: () => [] },
  showMap: { type: Boolean, default: true },
})

const router = useRouter()
const MP_TYPES = ['fragment', 'fiber', 'foam', 'film', 'sheets']

// --- State ---
const query = ref('')
const sortDir = ref('asc')
const sortBy = ref('name') // 'name' | 'density'
const mapRef = ref(null)

// Leaflet Instances (Non-reactive)
let mapInstance = null
let markersLayer = null
let polygonLayer = null
const markersMap = {}

// --- 1. Helper Functions ---

const getPracticeColor = (p) => {
  const practice = (p || '').toString().toLowerCase()
  if (practice.includes('organic')) return '#43a047'
  if (practice.includes('integrated')) return '#fb8c00'
  if (practice.includes('conventional')) return '#19568E'
  return '#9e9e9e'
}

const calculateDensity = (site) => {
  const totalMP = MP_TYPES.reduce((acc, key) => acc + (Number(site[`${key}_count`]) || 0), 0)
  const totalMass = (site.soilsamples || []).reduce((acc, s) => acc + (Number(s.mass_kg) || 0), 0)
  return totalMass > 0 ? totalMP / totalMass : 0
}

const toTitleCase = (str) => {
  return (str || '').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// --- 2. Data Processing ---

const processedSites = computed(() => {
  if (!props.sampledSites.length) return []

  // Pre-calculate metrics
  const sites = props.sampledSites.map(site => {
    const density = calculateDensity(site)
    return {
      ...site,
      _rawDensity: density,
      _practiceName: site.cultivation_practice || site.cultivation || 'Unknown',
      uiDensityLabel: density.toFixed(2)
    }
  })

  // Calculate UI Scaling
  const maxDensity = Math.max(...sites.map(s => s._rawDensity)) || 1
  const minRad = 6, maxRad = 22 // Slightly larger dots for better visibility

  return sites.map(site => ({
    ...site,
    uiColor: getPracticeColor(site._practiceName),
    uiRadius: site._rawDensity === 0 ? minRad : minRad + (site._rawDensity / maxDensity) * (maxRad - minRad)
  }))
})

const visibleSites = computed(() => {
  let list = [...processedSites.value]
  const q = query.value.trim().toLowerCase()

  if (q) {
    list = list.filter(s =>
      (s.site_name || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    )
  }

  return list.sort((a, b) => {
    const valA = sortBy.value === 'density' ? a._rawDensity : (a.site_name || '').toLowerCase()
    const valB = sortBy.value === 'density' ? b._rawDensity : (b.site_name || '').toLowerCase()

    if (valA < valB) return sortDir.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

// --- 3. Map Logic ---

const initMap = async () => {
  if (!mapRef.value || mapInstance) return

  // 1. Set tighter default zoom (13 instead of 11)
  mapInstance = L.map(mapRef.value, { scrollWheelZoom: false }).setView([14.03, 121.58], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(mapInstance)

  markersLayer = L.layerGroup().addTo(mapInstance)

  // Load Tayabas Boundary
  try {
    const geoUrl = new URL('../assets/geojson/Tayabas.geojson', import.meta.url).href
    const data = await fetch(geoUrl).then(res => res.json())

    polygonLayer = L.geoJSON(data, {
      style: { color: CHART_COLORS[0], weight: 2, fillColor: CHART_COLORS[0], fillOpacity: 0.06 }
    }).addTo(mapInstance)
  } catch (e) { /* silent fail */ }

  updateMapMarkers()
}

const updateMapMarkers = () => {
  if (!mapInstance || !markersLayer) return

  markersLayer.clearLayers()
  // Clean dictionary
  Object.keys(markersMap).forEach(key => delete markersMap[key])

  const bounds = []

  processedSites.value.forEach(site => {
    if (!site.latitude || !site.longitude) return

    const marker = L.circleMarker([site.latitude, site.longitude], {
      radius: site.uiRadius,
      fillColor: site.uiColor,
      color: '#fff',
      weight: 1.5,
      fillOpacity: 0.95
    })

    const tooltip = `<strong>${site.site_name}</strong><br/>${toTitleCase(site._practiceName)}<br/>${site.uiDensityLabel} MP/kg`
    marker.bindPopup(tooltip).bindTooltip(tooltip, { sticky: true })
    marker.on('dblclick', () => navigateToSite(site))
    marker.addTo(markersLayer)

    markersMap[site.id] = marker
    bounds.push([site.latitude, site.longitude])
  })

  // Smart Zoom Strategy:
  // If we have markers, zoom to them (but max zoom 16 to avoid being too close).
  // If no markers, fall back to the polygon (Tayabas boundary).
  if (bounds.length > 0) {
    mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
  } else if (polygonLayer && polygonLayer.getBounds) {
    mapInstance.fitBounds(polygonLayer.getBounds(), { padding: [20, 20] })
  }
}

const destroyMap = () => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
    markersLayer = null
    polygonLayer = null
  }
}

// --- 4. Actions ---

const focusSite = (site) => {
  const marker = markersMap[site.id]
  if (mapInstance && marker) {
    // Zoom in close when clicking a list item
    mapInstance.setView(marker.getLatLng(), 16, { animate: true })
    marker.openPopup()
  }
}

const navigateToSite = (site) => {
  if (site?.site_name) router.push(`/insight/${encodeURIComponent(site.site_name)}`)
}

// --- 5. Watchers ---

onMounted(() => { if (props.showMap) initMap() })
onBeforeUnmount(() => destroyMap())

watch(() => props.showMap, (val) => val ? initMap() : destroyMap())
watch(processedSites, updateMapMarkers, { deep: true })
</script>

<template>
  <div>
    <div v-if="showMap" class="map-wrap mt-2">
      <div ref="mapRef" class="map-canvas" />
    </div>

    <div class="list-controls mt-6">
      <input v-model="query" class="search-input" placeholder="Search farms or address">

      <div class="sort-buttons">
        <button class="sort-btn" :class="{ active: sortBy === 'name' }" @click="sortBy = 'name'" title="Sort by Name">
          <VIcon small>mdi-sort-alphabetical-ascending</VIcon>
        </button>
        <button class="sort-btn" :class="{ active: sortBy === 'density' }" @click="sortBy = 'density'"
          title="Sort by Contamination">
          <VIcon small>mdi-sort-numeric-descending</VIcon>
        </button>
        <button class="sort-btn" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'" title="Toggle Direction">
          <VIcon small>{{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</VIcon>
        </button>
      </div>
    </div>

    <ul :class="['sampled-farms', { 'no-max-height': !showMap }]">
      <li v-for="site in visibleSites" :key="site.id" class="farm-row" @click="focusSite(site)"
        @dblclick.prevent="navigateToSite(site)">

        <div class="farm-left">
          <div class="farm-name">{{ site.site_name }}</div>
          <div class="farm-addr">{{ site.address }}</div>
        </div>

        <div class="farm-right">
          <div class="farm-density">{{ site.uiDensityLabel }} MP/kg</div>
          <span class="practice-badge" :style="{ background: site.uiColor }">
            {{ toTitleCase(site._practiceName) }}
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.list-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 22px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: white;
  font-size: 16px;
}

.sort-buttons {
  display: flex;
  gap: 8px;
}

.sort-btn {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-btn:hover {
  background: #f9f9f9;
  border-color: rgba(0, 0, 0, 0.12);
}

.sort-btn.active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

.sampled-farms {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 570px;
  overflow: auto;
}

.sampled-farms.no-max-height {
  max-height: none;
  overflow: visible;
}

.farm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f6f6f7;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02) inset;
  cursor: pointer;
}

.farm-row:hover {
  opacity: 0.98;
}

.farm-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 65%;
}

.farm-name {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  word-break: break-word;
}

.farm-addr {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  word-break: break-word;
}

.farm-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.farm-density {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.practice-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.map-wrap {
  border-radius: 8px;
  overflow: hidden;
  height: 320px;
}

.map-canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 700px) {
  .farm-row {
    align-items: flex-start;
  }

  .farm-left {
    max-width: 55%;
  }
}
</style>