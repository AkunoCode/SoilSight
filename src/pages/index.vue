<template>
  <v-app>
    <v-main>
      <div id="map"></div>
    </v-main>
  </v-app>
</template>

<script setup>
import { onMounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VCardTitle } from "vuetify/components";

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
</style>
