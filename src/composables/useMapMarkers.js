import L from 'leaflet'
import { ref } from 'vue'
import {
  MARKER_COLOR_CONVENTIONAL,
  MARKER_COLOR_INTEGRATED,
  MARKER_COLOR_ORGANIC,
  MARKER_COLOR_OTHER,
  MARKER_SIZE_MAX,
  MARKER_SIZE_MIN,
} from '@/config/constants.js'
import { calculateTotalMP } from '@/utils/microplasticsHelper.js'

export function useMapMarkers (allFarmsData, mapRef) {
  const markersRef = ref([])

  function getMarkerColor (practice) {
    const p = (practice || '').toLowerCase()
    if (p.includes('integrated')) {
      return MARKER_COLOR_INTEGRATED
    }
    if (p.includes('organic')) {
      return MARKER_COLOR_ORGANIC
    }
    if (p.includes('conventional')) {
      return MARKER_COLOR_CONVENTIONAL
    }
    return MARKER_COLOR_OTHER
  }

  function createMarker (item, minMP, maxMP) {
    if (!item.latitude || !item.longitude || !mapRef.value) {
      return null
    }

    const color = getMarkerColor(item.cultivation_practice)
    const totalMP = calculateTotalMP(item)
    const minSize = MARKER_SIZE_MIN
    const maxSize = MARKER_SIZE_MAX
    const markerSize = totalMP > 0
      ? minSize + ((totalMP - minMP) / (maxMP - minMP)) * (maxSize - minSize)
      : minSize

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color:${color};width:${markerSize}px;height:${markerSize}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [markerSize, markerSize],
      iconAnchor: [markerSize / 2, markerSize / 2],
    })

    const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(mapRef.value)
    marker._item = item
    marker.bindPopup(`
      <div style="min-width:250px;">
        <strong style="color:${color};font-size:16px;">${item.site_name ?? 'Unknown Site'}</strong><br/>
        <hr style="margin:8px 0;"/>
        <strong>Owner:</strong> ${item.owner ?? 'N/A'}<br/>
        <strong>Area:</strong> ${item.land_area_ha ?? '?'} hectares<br/>
        <strong>Practice:</strong> ${item.cultivation_practice ?? 'N/A'}<br/>
        ${totalMP > 0 ? `<strong>Microplastics:</strong> ${totalMP} particles<br/>` : ''}
        ${item.address ? `<strong>Address:</strong> ${item.address}<br/>` : ''}
        ${item.soil_type ? `<strong>Soil Type:</strong> ${item.soil_type}<br/>` : ''}
        ${item.crops ? `<strong>Crops:</strong> ${item.crops.join(', ')}<br/>` : ''}
        ${item.water_source ? `<strong>Water Source:</strong> ${item.water_source}<br/>` : ''}
      </div>
    `)
    marker.on('click', e => {
      L.DomEvent?.stopPropagation(e)
    })
    return marker
  }

  function clearMarkers () {
    if (!mapRef.value) {
      return
    }
    for (const m of markersRef.value) {
      try {
        mapRef.value.removeLayer(m)
      } catch { /* ignore */ }
    }
    markersRef.value = []
  }

  function addMarkers (items) {
    if (!mapRef.value || !Array.isArray(items)) {
      return
    }
    clearMarkers()

    // Pre-compute global MP range once — O(n) instead of O(n²)
    const allMPs = allFarmsData.value.map(f => calculateTotalMP(f)).filter(n => n > 0)
    const minMP = Math.min(...allMPs, 1)
    const maxMP = Math.max(...allMPs, 1)

    for (const item of items) {
      try {
        const marker = createMarker(item, minMP, maxMP)
        if (marker) {
          markersRef.value.push(marker)
        }
      } catch (error) {
        console.error('Error adding marker:', error, item)
      }
    }
  }

  return { markersRef, getMarkerColor, createMarker, clearMarkers, addMarkers }
}
