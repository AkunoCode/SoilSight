<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    lat: { type: Number, required: false },
    lng: { type: Number, required: false },
    zoom: { type: Number, default: 13 },
    marker: { type: Boolean, default: true }
})

const mapRef = ref(null)
let map = null
let markerLayer = null

onMounted(() => {
    // Create map only if element exists
    if (!mapRef.value) return
    map = L.map(mapRef.value, { scrollWheelZoom: false }).setView([props.lat || 14.03, props.lng || 121.58], props.zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    if (props.marker && props.lat != null && props.lng != null) {
        markerLayer = L.circleMarker([props.lat, props.lng], { radius: 8, color: '#1976D2', weight: 2 }).addTo(map)
    }
})

onBeforeUnmount(() => {
    if (map) {
        map.remove()
        map = null
    }
})

// update view when props change
watch(() => [props.lat, props.lng, props.zoom], ([lat, lng, zoom]) => {
    if (!map) return
    if (lat != null && lng != null) {
        map.setView([lat, lng], zoom || map.getZoom())
        if (markerLayer) {
            markerLayer.setLatLng([lat, lng])
        } else if (props.marker) {
            markerLayer = L.circleMarker([lat, lng], { radius: 8, color: '#1976D2', weight: 2 }).addTo(map)
        }
    }
})
</script>

<template>
    <div ref="mapRef" style="height: 230px; width: 100%; border-radius:8px; overflow:hidden;"></div>
</template>

<style scoped>
/* ensure leaflet map fits container */
:deep(.leaflet-container) {
    height: 100%;
    width: 100%;
}
</style>
