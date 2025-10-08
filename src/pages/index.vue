<template>
  <v-app>
    <v-main>
      <div class="overlay">
        <PreviewCard ref="previewCardRef" :title="selectedItem ? selectedItem.site_name : 'Tayabas City'"
          :subtitle="selectedItem ? `Owner: ${selectedItem.owner} | ${selectedItem.cultivation_practice}` : 'Microplastic Analysis Overview'"
          :item="selectedItem" :isOverview="!selectedItem" :allFarmsData="allFarmsData" class="preview-card" />
      </div>
      <div id="map"></div>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PreviewCard from "@/components/PreviewCard.vue";

const selectedItem = ref(null);
const isOverview = ref(true);
const allFarmsData = ref([]);
const previewCardRef = ref(null);

const setPreviewCardData = (item) => {
  console.log("Preview Card Data:", item);
  selectedItem.value = item;
  isOverview.value = false;

  // Automatically raise the preview card when a marker is clicked
  if (previewCardRef.value && previewCardRef.value.raiseCard) {
    previewCardRef.value.raiseCard();
  }
};

const resetToOverview = () => {
  console.log("Resetting to overview mode");
  selectedItem.value = null;
  isOverview.value = true;
};

const createMarker = (item, map) => {
  if (!item.latitude || !item.longitude) {
    console.log("Skipping item - missing coordinates:", item);
    return;
  }

  // Create custom icon based on cultivation practice
  const getMarkerColor = (practice) => {
    const practiceStr = practice?.toLowerCase() || '';
    if (practiceStr.includes('integrated')) {
      return '#FF9800'; // Orange
    } else if (practiceStr.includes('organic')) {
      return '#4CAF50'; // Green
    } else if (practiceStr.includes('conventional')) {
      return '#19568E'; // Blue
    } else {
      return '#757575'; // Grey
    }
  };

  const color = getMarkerColor(item.cultivation_practice);

  // Create custom icon
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(map);

  // Enhanced popup content based on actual data structure
  marker.bindPopup(`
    <div style="min-width: 250px;">
      <strong style="color: ${color}; font-size: 16px;">${item.site_name ?? "Unknown Site"}</strong><br/>
      <hr style="margin: 8px 0;"/>
      <strong>Owner:</strong> ${item.owner ?? "N/A"}<br/>
      <strong>Area:</strong> ${item.land_area_ha ?? "?"} hectares<br/>
      <strong>Practice:</strong> ${item.cultivation_practice ?? "N/A"}<br/>
      ${item.address ? `<strong>Address:</strong> ${item.address}<br/>` : ''}
      ${item.soil_type ? `<strong>Soil Type:</strong> ${item.soil_type}<br/>` : ''}
      ${item.crops ? `<strong>Crops:</strong> ${item.crops.join(', ')}<br/>` : ''}
      ${item.water_source ? `<strong>Water Source:</strong> ${item.water_source}<br/>` : ''}
    </div>
  `);

  // Click event to update preview card
  marker.on("click", (e) => {
    console.log("Marker clicked:", item.site_name);
    // Prevent the map click event from firing
    L.DomEvent.stopPropagation(e);
    setPreviewCardData(item);
  });

  return marker;
};

onMounted(async () => {
  console.log("Initializing map...");

  // Wait a moment for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    // Tayabas City coordinates
    const tayabas = [13.9649, 121.5923];
    const map = L.map("map").setView(tayabas, 13);
    console.log("Map instance created");

    // Shift the map view to the right to accommodate the preview card
    setTimeout(() => {
      map.panBy([-160, 0]); // Pan left by 160px to center content in visible area
    }, 100);

    // Base map
    const tileLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
        maxZoom: 19
      }
    );
    tileLayer.addTo(map);
    console.log("Tile layer added");

    // Add map click event to reset selection when clicking on empty areas
    map.on('click', (e) => {
      console.log("Map clicked - resetting to overview");
      resetToOverview();
    });

    // Load and add GeoJSON boundary
    try {
      console.log("Loading GeoJSON...");
      const geoResponse = await fetch("/src/assets/geojson/Tayabas.geojson");

      if (!geoResponse.ok) {
        throw new Error(`HTTP error! status: ${geoResponse.status}`);
      }

      const tayabasGeo = await geoResponse.json();
      console.log("GeoJSON loaded successfully:", tayabasGeo);

      const geoLayer = L.geoJSON(tayabasGeo, {
        style: {
          color: "#2264A2",
          weight: 3,
          dashArray: "5, 5",
          fillColor: "#2264A2",
          fillOpacity: 0.1,
        },
        interactive: false, // Disable all interactions (clicks, hover, etc.)
        // Removed onEachFeature to prevent popups and click events
      }).addTo(map);

      // Fit the map to the GeoJSON boundary with padding to account for preview card
      map.fitBounds(geoLayer.getBounds(), {
        paddingTopLeft: [350, 50], // Extra left padding for preview card + margins
        paddingBottomRight: [50, 50]
      });

      // Additional pan adjustment after fitting bounds
      setTimeout(() => {
        map.panBy([-100, 0]); // Fine-tune position to center in visible area
      }, 200);

      console.log("GeoJSON layer added and map bounds set");

    } catch (geoError) {
      console.error("Error loading GeoJSON:", geoError);
      console.log("Continuing without GeoJSON boundary");
    }

    // Load dummy data for markers
    try {
      console.log("Loading marker data...");
      const dataResponse = await fetch("/src/assets/dummyData.json");

      if (!dataResponse.ok) {
        throw new Error(`HTTP error! status: ${dataResponse.status}`);
      }

      const data = await dataResponse.json();
      console.log("Raw data loaded:", data);

      // Extract the sites array from the data structure
      const items = data.sites || data || [];
      console.log("Marker data loaded. Total items:", items.length);

      // Store all farms data for the PreviewCard
      allFarmsData.value = items;

      if (!Array.isArray(items)) {
        throw new Error("Data is not an array. Structure: " + JSON.stringify(Object.keys(data)));
      }

      // Filter items with valid coordinates
      const validItems = items.filter(item => {
        const hasCoords = item.latitude && item.longitude;
        if (!hasCoords) {
          console.log("Item missing coordinates:", item.site_name || item.id);
        }
        return hasCoords;
      });
      console.log("Items with valid coordinates:", validItems.length);

      if (validItems.length === 0) {
        console.warn("No items have valid latitude/longitude coordinates");
        return;
      }

      // Add all markers
      const markers = [];
      validItems.forEach((item, index) => {
        try {
          console.log(`Creating marker ${index + 1}: ${item.site_name} at [${item.latitude}, ${item.longitude}]`);
          const marker = createMarker(item, map);
          if (marker) {
            markers.push(marker);
            console.log(`✓ Marker ${index + 1}/${validItems.length} added:`, item.site_name);
          }
        } catch (markerError) {
          console.error(`✗ Error creating marker for item ${index}:`, markerError, item);
        }
      });

      console.log(`Successfully added ${markers.length} markers to map`);

      // Create a marker group for easier management
      if (markers.length > 0) {
        const markerGroup = L.featureGroup(markers);
        console.log("Marker group created with bounds:", markerGroup.getBounds());

        // Optionally fit bounds to show all markers (uncomment if needed)
        // map.fitBounds(markerGroup.getBounds(), { padding: [20, 20] });
      }

    } catch (dataError) {
      console.error("Error loading marker data:", dataError);
      console.log("Continuing without markers");
    }

    // Force map to refresh
    setTimeout(() => {
      map.invalidateSize();
      console.log("Map size invalidated");
    }, 100);

  } catch (error) {
    console.error("Error initializing map:", error);
  }
});
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
</style>
