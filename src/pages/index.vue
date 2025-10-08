<template>
  <v-app>
    <v-main>
      <div class="overlay">
        <PreviewCard title="Tayabas City" class="preview-card" />
      </div>
      <div id="map"></div>
    </v-main>
  </v-app>
</template>

<script setup>
import { onMounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

onMounted(async () => {
  // Tayabas City coordinates (center)
  const tayabas = [13.9649, 121.5923];

  const map = L.map("map").setView(tayabas, 13);

  // Base map
  L.tileLayer("https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
  }).addTo(map);

  // Load GeoJSON boundary (file is in src/assets/geojson/Tayabas.geojson)
  const res = await fetch("/src/assets/geojson/Tayabas.geojson");
  const data = await res.json();

  const geoLayer = L.geoJSON(data, {
    style: {
      color: "#2264A2",
      weight: 3,
      dashArray: "5, 5",
      fillColor: "#2264A2",
      fillOpacity: 0.1
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties?.name) {
        layer.bindPopup(feature.properties.name);
      }
    }
  }).addTo(map);

  // Fit map to boundary
  map.fitBounds(geoLayer.getBounds());
});
</script>

<style>
#map {
  height: 100vh;
  width: 100vw;
  position: absolute;
  z-index: 0;
}

.overlay {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 1000;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Allow clicks to pass through to the map */
}

.preview-card {
  position: absolute;
  bottom: 0px;
  left: 2em;
  z-index: 1001;
  pointer-events: auto;
  /* Re-enable interactions for the preview card */
}
</style>
