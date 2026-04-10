<template>
  <v-app>
    <v-main>
      <div class="overlay">
        <!-- Top-left breadcrumb navigation -->
        <div class="breadcrumb-container">
          <div class="breadcrumb-subtitle">Plastic Contamination Map</div>
          <div class="breadcrumb-title">
            <span
              :aria-label="`Zoom to ${regionName}`"
              class="breadcrumb-region breadcrumb-link"
              role="button"
              tabindex="0"
              @click="gotoRegion"
              @keydown.enter="gotoRegion"
              @keydown.space.prevent="gotoRegion"
            >{{ regionName }}</span>
            <span class="breadcrumb-sep">&nbsp;›&nbsp;</span>
            <span
              :aria-label="`Zoom to ${cityName}`"
              class="breadcrumb-city breadcrumb-link"
              role="button"
              tabindex="0"
              @click="gotoCity"
              @keydown.enter="gotoCity"
              @keydown.space.prevent="gotoCity"
            >{{ cityName }}</span>
            <template v-if="selectedItem">
              <span class="breadcrumb-sep">&nbsp;›&nbsp;</span>
              <span
                :aria-label="`Zoom to ${selectedItem.site_name}`"
                class="breadcrumb-farm breadcrumb-link"
                role="button"
                tabindex="0"
                @click="gotoFarm"
                @keydown.enter="gotoFarm"
                @keydown.space.prevent="gotoFarm"
              >{{ selectedItem.site_name }}</span>
            </template>
          </div>
        </div>

        <!-- Top-right controls: search + category filter -->
        <div class="top-controls" role="search">
          <div class="control-surface">
            <v-select
              v-model="selectedCategory"
              clearable
              dense
              hide-details
              :items="categories"
              placeholder="Select farming practice category"
              style="min-width: 300px;"
              variant="outlined"
            />
          </div>

          <div class="control-surface" style="margin-left: 12px;">
            <v-text-field
              v-model="searchText"
              append-inner-icon="mdi-magnify"
              clearable
              dense
              hide-details
              placeholder="Search here"
              style="min-width: 360px;"
              variant="outlined"
            />
          </div>
        </div>

        <PreviewCard
          ref="previewCardRef"
          :all-farms-data="allFarmsData"
          class="preview-card"
          :is-overview="!selectedItem"
          :item="selectedItem"
          :subtitle="selectedItem ? `Owner: ${selectedItem.owner} | ${selectedItem.cultivation_practice}` : 'Microplastic Analysis Overview'"
          :title="selectedItem ? selectedItem.site_name : 'Tayabas City'"
        />
      </div>
      <div
        id="map"
        aria-label="Interactive microplastic contamination map of Tayabas City, Quezon Province"
        role="application"
      />
      <VSnackbar
        v-model="dataError"
        color="warning"
        location="top"
        timeout="8000"
      >
        {{ dataErrorMsg }}
        <template #actions>
          <VBtn variant="text" @click="dataError = false">Dismiss</VBtn>
        </template>
      </VSnackbar>
    </v-main>
  </v-app>
</template>

<script setup>
  import { readItems } from '@directus/sdk'
  import L from 'leaflet'
  import { computed, onMounted, ref, watch } from 'vue'
  import tayabasGeoRaw from '@/assets/geojson/Tayabas.geojson?raw'
  import PreviewCard from '@/components/PreviewCard.vue'
  import directus from '@/composables/useDirectus'
  import { useMapMarkers } from '@/composables/useMapMarkers.js'
  import { CHART_COLORS } from '@/config/chartPalette'
  import {
    MAP_BOUNDS_PADDING,
    MAP_CENTER,
    MAP_INITIAL_PAN_X,
    MAP_ZOOM_CITY,
    MAP_ZOOM_FARM,
    MAP_ZOOM_MAX,
    MAP_ZOOM_REGION,
    SEARCH_DEBOUNCE_MS,
  } from '@/config/constants.js'
  import { useAppStore } from '@/stores/app'
  import 'leaflet/dist/leaflet.css'
  const tayabasGeo = JSON.parse(tayabasGeoRaw)

  const selectedItem = ref(null)
  const isOverview = ref(true)
  const allFarmsData = ref([])
  const previewCardRef = ref(null)
  const searchText = ref('')
  const selectedCategory = ref(null)
  const regionName = ref('Quezon Province')
  const cityName = ref('Tayabas City')
  const TAYABAS = MAP_CENTER
  const mapRef = ref(null)
  let debounceTimer = null
  const dataError = ref(false)
  const dataErrorMsg = ref('')

  const { markersRef, addMarkers, clearMarkers, getMarkerColor } = useMapMarkers(allFarmsData, mapRef)

  async function fetchDataFromDirectus () {
    try {
      const res = await directus.request(readItems('sites'))
      const items = Array.isArray(res) ? res : (res?.data || [])
      allFarmsData.value = items
      return items
    } catch (error) {
      console.error('Error fetching farms data from Directus:', error)
      dataErrorMsg.value = error?.message || 'Failed to load farm data. Check your connection.'
      dataError.value = true
      throw error
    }
  }

  function setPreviewCardData (item) {
    selectedItem.value = item
    isOverview.value = false
    if (previewCardRef.value?.raiseCard) previewCardRef.value.raiseCard()
  }

  function resetToOverview () {
    selectedItem.value = null
    isOverview.value = true
  }

  function gotoRegion () {
    resetToOverview()
    if (mapRef.value) mapRef.value.setView(TAYABAS, MAP_ZOOM_REGION)
  }

  function gotoCity () {
    resetToOverview()
    if (mapRef.value) mapRef.value.setView(TAYABAS, MAP_ZOOM_CITY)
  }

  function gotoFarm () {
    if (!selectedItem.value || !mapRef.value) return
    const item = selectedItem.value
    if (item.latitude && item.longitude) {
      mapRef.value.panTo([item.latitude, item.longitude])
      mapRef.value.setZoom(MAP_ZOOM_FARM)
    }
    if (previewCardRef.value?.raiseCard) previewCardRef.value.raiseCard()
  }

  const categories = computed(() => {
    const set = new Set()
    for (const i of (allFarmsData.value || [])) {
      if (i.cultivation_practice) set.add(i.cultivation_practice)
    }
    return Array.from(set.values())
  })

  function applyFilters () {
    const q = (searchText.value || '').toLowerCase().trim()
    const cat = selectedCategory.value || 'All'
    const items = Array.isArray(allFarmsData.value) ? allFarmsData.value : []
    const filtered = items.filter(item => {
      if (cat && cat !== 'All' && item.cultivation_practice !== cat) return false
      if (!q) return true
      return (item.site_name || '').toLowerCase().includes(q)
    })
    addMarkers(filtered.filter(i => i.latitude && i.longitude))
  }

  watch([searchText, selectedCategory], () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => applyFilters(), SEARCH_DEBOUNCE_MS)
  })

  onMounted(async () => {
    const app = useAppStore()
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const map = L.map('map', { zoomControl: false }).setView(TAYABAS, MAP_ZOOM_CITY)
      mapRef.value = map
      setTimeout(() => map.panBy([MAP_INITIAL_PAN_X, 0]), 100)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
        maxZoom: MAP_ZOOM_MAX,
      }).addTo(map)

      map.on('click', resetToOverview)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      const legend = L.control({ position: 'bottomright' })
      legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'legend-box')
        L.DomEvent.disableClickPropagation(div)
        const entries = [
          { label: 'Integrated', color: getMarkerColor('integrated') },
          { label: 'Organic', color: getMarkerColor('organic') },
          { label: 'Conventional', color: getMarkerColor('conventional') },
          { label: 'Other', color: getMarkerColor('other') },
        ]
        let html = ''
        for (const e of entries) {
          html += `<div class="legend-entry"><span class="legend-swatch" style="background:${e.color}"></span><span class="legend-label">${e.label}</span></div>`
        }
        div.innerHTML = html
        return div
      }
      legend.addTo(map)

      try {
        const geoLayer = L.geoJSON(tayabasGeo, {
          style: { color: CHART_COLORS[0], weight: 3, dashArray: '5, 5', fillColor: CHART_COLORS[0], fillOpacity: 0.1 },
          interactive: false,
        }).addTo(map)
        map.fitBounds(geoLayer.getBounds(), { paddingTopLeft: MAP_BOUNDS_PADDING.topLeft, paddingBottomRight: MAP_BOUNDS_PADDING.bottomRight })
        setTimeout(() => map.panBy([-100, 0]), 200)
      } catch (geoError) {
        console.error('Error adding GeoJSON:', geoError)
      }

      try {
        app.startLoading()
        const items = await fetchDataFromDirectus()
        allFarmsData.value = items
        applyFilters()
      } catch (dataError) {
        console.error('Error loading marker data from Directus:', dataError)
      } finally {
        try {
          app.finishLoading()
        } catch { /* ignore */ }
      }

      setTimeout(() => map.invalidateSize(), 100)
    } catch (error) {
      console.error('Error initializing map:', error)
    }
  })
</script>

<style>
#map {
  height: 100vh;
  width: 100vw;
  position: absolute;
  z-index: 0;
  background-color: #f0f0f0;
  /* Add background to see if container is visible */
}

.overlay {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 1000;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* allow map clicks through */
}

.preview-card {
  position: absolute;
  bottom: 0px;
  left: 2em;
  z-index: 1001;
  pointer-events: auto;
  /* re-enable interaction for card */
}

.top-controls {
  position: absolute;
  top: 2rem;
  right: 1.5rem;
  z-index: 1100;
  display: flex;
  align-items: center;
  pointer-events: auto;
  /* allow interaction */
  /* background: rgba(255, 255, 255, 0.85); */
  /* padding: 6px 10px; */
  /* border-radius: 8px; */
  /* box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12); */
}

.control-surface {
  background: white;
  border-radius: 8px;
  /* padding: 4px 6px; */
  display: inline-flex;
  align-items: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.193);
}

.top-controls .v-text-field .v-input__slot,
.top-controls .v-select .v-input__slot {
  background: transparent !important;
  box-shadow: none !important;
}

/* Breadcrumb (top-left) */
.breadcrumb-container {
  position: absolute;
  top: 2rem;
  left: 2rem;
  z-index: 1120;
  pointer-events: auto;
}

.breadcrumb-subtitle {
  color: rgb(74, 74, 74);
  font-weight: 600;
  /* margin-bottom: 4px; */
  font-size: 18px;
  margin: 0;
}

.breadcrumb-title {
  margin: 0;
  color: rgb(0, 0, 0);
  font-weight: 800;
  font-size: 32px;
  letter-spacing: -0.5px;
  line-height: 1em;
}

.breadcrumb-sep {
  color: rgb(106, 106, 106);
}

.breadcrumb-region,
.breadcrumb-city {
  display: inline-block;
}

.breadcrumb-link {
  cursor: pointer;
}

.breadcrumb-link:hover {
  text-decoration: underline;
  color: #1d50aa;
}

/* Legend styles */
.legend-box {
  background: white;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 8px;
  /* offset slightly to appear below zoom controls */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  font-size: 14px;
  line-height: 1.3;
  pointer-events: auto;
  min-width: 180px;
}

.legend-entry {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-entry:last-child {
  margin-bottom: 0;
}

.legend-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 10px;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
}

.legend-label {
  color: #222;
  font-weight: 500;
}

/* Move the bottom-right control group a little away from the right edge */
.leaflet-bottom.leaflet-right {
  right: 1.5rem !important;
}
</style>
