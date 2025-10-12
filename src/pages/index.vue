<template>
  <v-app>
    <v-main>
      <div class="overlay">
        <!-- Top-left breadcrumb navigation -->
        <div class="breadcrumb-container">
          <div class="breadcrumb-subtitle">Plastic Contamination Map</div>
          <div class="breadcrumb-title">
            <span class="breadcrumb-region breadcrumb-link" @click="gotoRegion">{{ regionName }}</span>
            <span class="breadcrumb-sep">&nbsp;›&nbsp;</span>
            <span class="breadcrumb-city breadcrumb-link" @click="gotoCity">{{ cityName }}</span>
            <template v-if="selectedItem">
              <span class="breadcrumb-sep">&nbsp;›&nbsp;</span>
              <span class="breadcrumb-farm breadcrumb-link" @click="gotoFarm">{{ selectedItem.site_name }}</span>
            </template>
          </div>
        </div>

        <!-- Top-right controls: search + category filter -->
        <div class="top-controls" role="search">
          <div class="control-surface">
            <v-select v-model="selectedCategory" :items="categories" dense variant="outlined" clearable
              placeholder="Select farm category" hide-details style="min-width: 220px;" />
          </div>

          <div class="control-surface" style="margin-left: 12px;">
            <v-text-field v-model="searchText" dense clearable placeholder="Search here" variant="outlined"
              append-inner-icon="mdi-magnify" hide-details style="min-width: 360px;" />
          </div>
        </div>

        <PreviewCard ref="previewCardRef" :title="selectedItem ? selectedItem.site_name : 'Tayabas City'"
          :subtitle="selectedItem ? `Owner: ${selectedItem.owner} | ${selectedItem.cultivation_practice}` : 'Microplastic Analysis Overview'"
          :item="selectedItem" :isOverview="!selectedItem" :allFarmsData="allFarmsData" class="preview-card" />
      </div>
      <div id="map"></div>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PreviewCard from "@/components/PreviewCard.vue";

const selectedItem = ref(null);
const isOverview = ref(true);
const allFarmsData = ref([]);
const previewCardRef = ref(null);

// Controls
const searchText = ref("");
const selectedCategory = ref(null);

// Breadcrumb labels (can be wired to router or data later)
const regionName = ref("Quezon Province");
const cityName = ref("Tayabas City");

// Default center for Tayabas
const TAYABAS = [13.9649, 121.5923];

// Map + markers refs so we can manipulate them from outside onMounted
const mapRef = ref(null);
const markersRef = ref([]);
let debounceTimer = null;

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

// Breadcrumb actions
const gotoRegion = () => {
  // For now, reset selection and zoom out to region-level view
  resetToOverview();
  if (mapRef.value) {
    mapRef.value.setView(TAYABAS, 11);
  }
};

const gotoCity = () => {
  // Reset selection and center on the city (Tayabas)
  resetToOverview();
  if (mapRef.value) {
    mapRef.value.setView(TAYABAS, 13);
  }
};

const gotoFarm = () => {
  if (!selectedItem.value || !mapRef.value) return;
  const item = selectedItem.value;
  if (item.latitude && item.longitude) {
    mapRef.value.panTo([item.latitude, item.longitude]);
    mapRef.value.setZoom(16);
  }
  // ensure preview card remains open for this farm
  if (previewCardRef.value && previewCardRef.value.raiseCard) previewCardRef.value.raiseCard();
};

// Shared helper to map cultivation practice to a marker color
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

const createMarker = (item, map) => {
  if (!item.latitude || !item.longitude) {
    console.log("Skipping item - missing coordinates:", item);
    return;
  }

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
  // Attach the source item for later lookup (e.g., breadcrumb -> pan to farm)
  marker._item = item;

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

// Clear all existing markers from the map
const clearMarkers = () => {
  if (!mapRef.value) return;
  markersRef.value.forEach((m) => {
    try {
      mapRef.value.removeLayer(m);
    } catch (e) {
      // ignore
    }
  });
  markersRef.value = [];
};

// Add markers for a list of items (assumes mapRef is set)
const addMarkers = (items) => {
  if (!mapRef.value || !Array.isArray(items)) return;
  clearMarkers();
  items.forEach((item) => {
    try {
      const marker = createMarker(item, mapRef.value);
      if (marker) markersRef.value.push(marker);
    } catch (err) {
      console.error("Error adding marker:", err, item);
    }
  });
};

// Compute categories from data
const categories = computed(() => {
  const set = new Set();
  (allFarmsData.value || []).forEach((i) => {
    if (i.cultivation_practice) set.add(i.cultivation_practice);
  });
  return Array.from(set.values());
});

// Apply filters based on searchText and selectedCategory
const applyFilters = () => {
  const q = (searchText.value || "").toLowerCase().trim();
  const cat = (selectedCategory.value || "All");
  const items = Array.isArray(allFarmsData.value) ? allFarmsData.value : [];
  const filtered = items.filter((item) => {
    // category filter
    if (cat && cat !== "All") {
      if (!item.cultivation_practice || item.cultivation_practice !== cat) return false;
    }
    if (!q) return true;
    const name = (item.site_name || "").toLowerCase();
    return name.includes(q);
  });
  addMarkers(filtered.filter(i => i.latitude && i.longitude));
};

// Watch controls with a small debounce
watch([searchText, selectedCategory], () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    applyFilters();
  }, 180);
});

onMounted(async () => {
  console.log("Initializing map...");

  // Wait a moment for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    // Tayabas City coordinates
    const tayabas = [13.9649, 121.5923];
    // Disable default zoom control so we can place it bottom-right
    const map = L.map("map", { zoomControl: false }).setView(tayabas, 13);
    mapRef.value = map;
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

    // Add zoom control to bottom right
    const zoomControl = L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add a legend control directly below the zoom control
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend-box');
      // prevent map interactions when interacting with legend
      L.DomEvent.disableClickPropagation(div);

      // Build legend content — use same keys as getMarkerColor
      const entries = [
        { label: 'Integrated', color: getMarkerColor('integrated') },
        { label: 'Organic', color: getMarkerColor('organic') },
        { label: 'Conventional', color: getMarkerColor('conventional') },
        { label: 'Other', color: getMarkerColor('other') },
      ];

      div.innerHTML = entries.map(e => `
        <div class="legend-entry">
          <span class="legend-swatch" style="background:${e.color}"></span>
          <span class="legend-label">${e.label}</span>
        </div>
      `).join('');

      return div;
    };
    legend.addTo(map);

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

      // Add markers via the filter-aware helper so UI controls take effect
      applyFilters();

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
  color: #1e88e5;
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
