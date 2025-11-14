<script setup>
/* eslint-disable unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument */
import L from 'leaflet'
import { computed, defineProps, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import 'leaflet/dist/leaflet.css'
// We'll fetch the GeoJSON at runtime (some bundlers treat .geojson as asset URLs)

const props = defineProps({
  sampledSites: {
    type: Array,
    default: () => [],
  },
  // show or hide the map. default true for backward compatibility
  showMap: {
    type: Boolean,
    default: true,
  },
})

// local UI state
const query = ref('')
const sortBy = ref('name') // currently only 'name' is used
const sortDir = ref('desc') // 'asc' or 'desc'

const mapRef = ref(null)
const markersMap = {}
let markersLayer = null
let polygonLayer = null
const router = useRouter()



function colorForPractice(practice) {
  const p = (practice || '').toString().toLowerCase().trim()
  if (!p) return '#9e9e9e'
  if (p.includes('organic')) return '#43a047' // green
  if (p.includes('integrated')) return '#fb8c00' // orange
  if (p.includes('conventional')) return '#19568E' // blue
  return '#9e9e9e'
}

function initMap() {
  if (!mapRef.value || typeof window === 'undefined') return
  // prevent double-init
  if (mapRef.value.__leafletMap) return

  const map = L.map(mapRef.value, { scrollWheelZoom: false }).setView([14.03, 121.58], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map)
  // create a layer group for markers so we can refresh them
  markersLayer = L.layerGroup().addTo(map)

  // add polygon for Tayabas by fetching the geojson file at runtime
  try {
    const geoUrl = new URL('../assets/geojson/Tayabas.geojson', import.meta.url).href
    fetch(geoUrl)
      .then(r => r.json())
      .then(geojson => {
        polygonLayer = L.geoJSON(geojson, {
          style: () => ({ color: '#1976d2', weight: 2, fillColor: '#1976d2', fillOpacity: 0.06 }),
        }).addTo(map)
        // if polygon added and no markers, fit bounds to polygon
        try {
          if ((!props.sampledSites || props.sampledSites.length === 0) && polygonLayer && polygonLayer.getBounds) {
            const b = polygonLayer.getBounds()
            if (b.isValid()) map.fitBounds(b, { padding: [40, 40] })
          }
        } catch { /* ignore */ }
      })
      .catch(error => console.warn('Could not fetch Tayabas.geojson', error))
  } catch (error) {
    console.warn('Could not build Tayabas.geojson URL', error)
  }

  function addMarkersFromSites(sites) {
    markersLayer.clearLayers()
    const bounds = []
    for (const site of sites) {
      if (!site.latitude || !site.longitude) continue
      // use cultivation practice to color map markers to match index page
      const practice = site.cultivation_practice || site.cultivation || site.cultivationPractice || ''
      const color = colorForPractice(practice)
      const marker = L.circleMarker([site.latitude, site.longitude], {
        radius: 9,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.95,
      }).bindPopup(`<strong>${site.site_name}</strong><br/>${site.address}<br/>Practice: ${practice || 'Unknown'}`)
      marker.addTo(markersLayer)
      // navigate to farm on double-click of marker
      try { marker.on && marker.on('dblclick', () => navigateToSite(site)) } catch { }
      markersMap[site.id] = marker
      bounds.push([site.latitude, site.longitude])
    }

    // extend bounds with polygon bounds if present
    if (polygonLayer && polygonLayer.getBounds && polygonLayer.getBounds().isValid()) {
      const polyBounds = polygonLayer.getBounds()
      bounds.push([polyBounds.getSouthWest().lat, polyBounds.getSouthWest().lng], [polyBounds.getNorthEast().lat, polyBounds.getNorthEast().lng])
    }

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] })
  }

  // initial markers
  addMarkersFromSites(props.sampledSites)

  // expose a simple focus function on the map instance so list rows can pan/open popups
  mapRef.value.__leafletMap = map
}

function destroyMap() {
  try {
    const map = mapRef.value && mapRef.value.__leafletMap
    if (map) {
      map.remove()
    }
  } catch {
    // ignore removal errors
  }
  // reset references
  if (mapRef.value && mapRef.value.__leafletMap) delete mapRef.value.__leafletMap
  markersLayer = null
  polygonLayer = null
  for (const k of Object.keys(markersMap)) delete markersMap[k]
}

onMounted(() => {
  if (props.showMap) initMap()
})

// watch for showMap toggles to init / destroy map dynamically
watch(() => props.showMap, nv => {
  if (nv) initMap()
  else destroyMap()
})

// watch props and update markers when sampledSites changes
watch(() => props.sampledSites, nv => {
  const map = mapRef.value && mapRef.value.__leafletMap
  if (!map || !markersLayer) return
  // rebuild markers
  markersLayer.clearLayers()
  const bounds = []
  for (const site of nv) {
    if (!site.latitude || !site.longitude) continue
    const practice = site.cultivation_practice || site.cultivation || site.cultivationPractice || ''
    const color = colorForPractice(practice)
    const marker = L.circleMarker([site.latitude, site.longitude], {
      radius: 9,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      fillOpacity: 0.95,
    }).bindPopup(`<strong>${site.site_name}</strong><br/>${site.address}<br/>Practice: ${practice || 'Unknown'}`)
    marker.addTo(markersLayer)
    try { marker.on && marker.on('dblclick', () => navigateToSite(site)) } catch { }
    markersMap[site.id] = marker
    bounds.push([site.latitude, site.longitude])
  }
  if (polygonLayer && polygonLayer.getBounds && polygonLayer.getBounds().isValid()) {
    const polyBounds = polygonLayer.getBounds()
    bounds.push([polyBounds.getSouthWest().lat, polyBounds.getSouthWest().lng], [polyBounds.getNorthEast().lat, polyBounds.getNorthEast().lng])
  }
  if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] })
}, { deep: true })

function focusSite(site) {
  if (!site || !site.latitude || !site.longitude) return
  const map = mapRef.value && mapRef.value.__leafletMap
  const marker = markersMap[site.id]
  if (map) {
    map.setView([site.latitude, site.longitude], Math.max(map.getZoom(), 13), { animate: true })
    if (marker) marker.openPopup()
  }
}

function navigateToSite(site) {
  if (!site) return
  const farmName = encodeURIComponent(site.site_name || '')
  try {
    router.push(`/insight/${farmName}`)
  } catch {
    // ignore navigation errors
  }
}

function toggleSort() {
  // Toggle sort direction for name sorting
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

const filteredSites = computed(() => {
  const q = (query.value || '').trim().toLowerCase()
  let arr = props.sampledSites.map(s => ({ ...s }))
  if (q) {
    arr = arr.filter(s => (s.site_name || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q))
  }
  // Always sort by name; toggleSort flips `sortDir` between asc/desc
  arr = arr.toSorted((a, b) => {
    const an = (a.site_name || '').toLowerCase()
    const bn = (b.site_name || '').toLowerCase()
    return sortDir.value === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an)
  })
  return arr
})
</script>

<template>
  <div>
    <div class="list-controls">
      <input v-model="query" class="search-input" placeholder="Search farms or address">
      <button class="sort-btn" title="Toggle sort" @click="toggleSort">
        <VIcon small>mdi-sort-variant</VIcon>
      </button>
    </div>

    <ul :class="['sampled-farms', { 'no-max-height': !props.showMap }]">
      <li v-for="s in filteredSites" :key="s.id" class="farm-row" @click="focusSite(s)"
        @dblclick.prevent="navigateToSite(s)">
        <div class="farm-left">
          <div class="farm-name">{{ s.site_name }}</div>
          <div class="farm-addr">{{ s.address }}</div>
        </div>
        <div class="farm-right">
          <span class="practice-badge"
            :style="{ background: colorForPractice(s.cultivation_practice || s.cultivation || s.cultivationPractice || '') }">{{
              (s.cultivation_practice || s.cultivation || s.cultivationPractice || 'Unknown') }}</span>
        </div>
      </li>
    </ul>

    <div v-if="props.showMap" class="map-wrap mt-6">
      <div ref="mapRef" class="map-canvas" />
    </div>
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

.sort-btn {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sampled-farms {
  list-style: none;
  padding: 0;
  margin: 0 0 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 570px;
  /* limit height and allow scrolling when list is long */
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
  opacity: 0.98
}

.farm-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 70%;
}

.farm-name {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.farm-addr {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}

.farm-right {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: right;
}

.level-badge {
  display: inline-block;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 700;
  letter-spacing: .4px;
  text-transform: uppercase;
  font-size: 12px;
}

.practice-badge {
  display: inline-block;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  text-align: center;
}

.level-badge.high {
  background: #d32f2f
}

.level-badge.moderate {
  background: #fb8c00
}

.level-badge.low {
  background: #43a047
}

.level-badge.zero {
  background: #9e9e9e
}

.farm-addr,
.farm-name {
  word-break: break-word
}

.map-wrap {
  border-radius: 8px;
  overflow: hidden;
  height: 320px;

}

.map-canvas {
  width: 100%;
  height: 100%
}

@media (max-width: 700px) {
  .farm-row {
    align-items: flex-start;
    gap: 8px
  }

  .farm-left {
    max-width: 60%
  }
}
</style>
