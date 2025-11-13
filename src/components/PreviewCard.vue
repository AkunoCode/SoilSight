<script setup>
import { computed, ref, watch } from 'vue'
// import router
import { useRouter } from 'vue-router'
import { getDefaultBarOptions } from './graphs/defaultBarOptions.js'
import MPDonutChart from './graphs/MPDonutChart.vue'
import MPPracticeBar from './graphs/MPPracticeBar.vue'
import SampledFarms from './SampledFarms.vue'

const props = defineProps({
  title: { type: String, required: false, default: 'SoilSight Analysis' },
  subtitle: { type: String, required: false, default: '' },
  item: { type: Object, required: false, default: null },
  isOverview: { type: Boolean, required: false, default: true },
  allFarmsData: { type: Array, required: false, default: () => [] },
})

const router = useRouter()

// Compute totals from all farms data
const computeOverviewTotals = computed(() => (
  props.allFarmsData.length === 0
    ? {
      fragments: 648_000,
      fibers: 405_000,
      foams: 324_000,
      films: 162_000,
      pellets: 81_000,
    }
    : (() => {
      // Sum up all the microplastic counts from all farms
      const totals = props.allFarmsData.reduce((acc, farm) => {
        acc.fragments += farm.fragment_count || 0
        acc.fibers += farm.fiber_count || 0
        acc.foams += farm.foam_count || 0
        acc.films += farm.film_count || 0
        acc.pellets += farm.beads_count || 0
        return acc
      }, { fragments: 0, fibers: 0, foams: 0, films: 0, pellets: 0 })

      console.log('Computed overview totals from', props.allFarmsData.length, 'farms:', totals)
      return totals
    })()
))

// Use actual data from the selected item or fall back to computed overview data
const microplasticData = computed(() => (
  (props.item && !props.isOverview)
    ? {
      fragments: props.item.fragment_count || 0,
      fibers: props.item.fiber_count || 0,
      foams: props.item.foam_count || 0,
      films: props.item.film_count || 0,
      pellets: props.item.beads_count || 0, // Note: using beads_count for pellets
    }
    : computeOverviewTotals.value
))

// Computed title and subtitle based on mode
const displayTitle = computed(() => (props.item && !props.isOverview) ? (props.item.site_name || 'Farm Site Analysis') : props.title)

const displaySubtitle = computed(() => (props.item && !props.isOverview)
  ? `Owner: ${props.item.owner || 'Unknown'} | ${props.item.cultivation_practice || 'Unknown Practice'}`
  : (() => {
    const farmCount = props.allFarmsData.length
    const totalArea = props.allFarmsData.reduce((sum, farm) => sum + (farm.land_area_ha || 0), 0)
    return farmCount > 0 ? `${farmCount} Farms Analyzed | Total Area: ${totalArea.toFixed(2)} hectares` : props.subtitle
  })(),
)

const barChartDummySeries = ref([
  {
    name: 'Conventional Practice',
    data: [650, 420, 350, 190, 210],
  },
  {
    name: 'Organic Practice',
    data: [480, 300, 270, 130, 150],
  },
  {
    name: 'Integrated Practice',
    data: [500, 440, 280, 110, 80],
  },
])

// Store original bar chart data for filtering
const originalBarChartData = [
  {
    name: 'Conventional Practice',
    data: [650, 420, 350, 190, 210],
  },
  {
    name: 'Organic Practice',
    data: [480, 300, 270, 130, 150],
  },
  {
    name: 'Integrated Practice',
    data: [500, 440, 280, 110, 80],
  },
]

// Handler for selection events emitted by MPDonutChart
function onDonutSelection(key) {
  // reflect selection locally so custom labels opacity updates
  selectedKey.value = key
  const keyToIndex = {
    fragments: 0,
    fibers: 1,
    foams: 2,
    films: 3,
    pellets: 4,
  }

  // If selection is cleared (null), reset bar chart to original
  if (!key) {
    barChartDummySeries.value = [...originalBarChartData]
    barChartOptions.value = {
      ...barChartOptions.value,
      xaxis: {
        categories: [
          'Fragments',
          'Fibers',
          'Foam',
          'Films',
          'Pellets',
        ],
      },
    }
    return
  }

  // Otherwise, show only the selected category in the bar chart
  const selectedIndex = keyToIndex[key]
  barChartDummySeries.value = originalBarChartData.map(series => ({
    ...series,
    data: [series.data[selectedIndex]],
  }))

  barChartOptions.value = {
    ...barChartOptions.value,
    xaxis: {
      categories: [labelsMap[key]],
    },
  }
}

const total = computed(() => Object.values(microplasticData.value).reduce((a, b) => a + b, 0))

const percentages = computed(() => {
  const totalValue = total.value
  return totalValue === 0
    ? { fragments: 0, fibers: 0, foams: 0, films: 0, pellets: 0 }
    : {
      fragments: Math.round((microplasticData.value.fragments / totalValue) * 100),
      fibers: Math.round((microplasticData.value.fibers / totalValue) * 100),
      foams: Math.round((microplasticData.value.foams / totalValue) * 100),
      films: Math.round((microplasticData.value.films / totalValue) * 100),
      pellets: Math.round((microplasticData.value.pellets / totalValue) * 100),
    }
})

const colors = {
  fibers: '#19568E',
  fragments: '#0B2E4E',
  films: '#63B3FF',
  foams: '#4688C7',
  pellets: '#B9DDFF',
}

const labelsMap = {
  fragments: 'Fragments',
  fibers: 'Fibers',
  foams: 'Foams',
  films: 'Films',
  pellets: 'Pellets',
}

const aiSummaryText = `The analysis of microplastic contamination in Tayabas City agricultural soils reveals a significant presence of microplastics, with fragments being the most prevalent type, constituting 40% of the total microplastics found. Fibers account for 25%, followed by foams at 20%, films at 10%, and pellets at 5%. The data indicates that conventional farming practices contribute to higher levels of microplastic contamination compared to organic and integrated practices. This suggests that the use of plastic materials in conventional agriculture, such as plastic mulches and packaging, may be a major source of microplastic pollution in these soils. The findings highlight the need for sustainable farming practices and improved waste management to mitigate microplastic contamination in agricultural environments. Further research is recommended to explore the long-term effects of microplastics on soil health and crop productivity.`

// Chart options
const donutChartOptions = ref({
  chart: {
    type: 'donut',
    height: 350,
    toolbar: { show: false },
    events: {
      dataPointSelection: function (event, chartContext, config) {
        // Get the index of the clicked segment
        const dataPointIndex = config.dataPointIndex

        // Map index to key
        const indexToKey = ['fragments', 'fibers', 'foams', 'films', 'pellets']
        const clickedKey = indexToKey[dataPointIndex]

        // Only handle clicks if we're showing all categories (not filtered)
        if (selectedKey.value === null) {
          handleLegendClick(clickedKey)
        }
      },
    },
  },
  labels: ['Fragments', 'Fibers', 'Foams', 'Films', 'Pellets'],
  colors: Object.values(colors),
  dataLabels: { enabled: false },
  legend: { show: false },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          name: { show: true, fontSize: '16px' },
          value: { show: true, fontSize: '22px', fontWeight: 'bold' },
          total: {
            show: true,
            label: 'Total number\nof MP found',
            fontSize: '14px',
            formatter: function (w) {
              const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0)

              // Format number to millions
              if (total >= 1_000_000) {
                return (total / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
              } else if (total >= 1000) {
                return (total / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
              }
              return total // if below 1K
            },
          },
        },
      },
    },
  },
})

const barChartOptions = ref(getDefaultBarOptions([
  'Fragments',
  'Fibers',
  'Foam',
  'Films',
  'Pellets',
]))

const donutChart = ref(null)

// Chart key for forcing re-renders when needed
const chartKey = ref(0)

// Track selected key
const selectedKey = ref(null)

// Dragging functionality for the entire preview card
const isDragging = ref(false)
const previewCard = ref(null)
const dragStartY = ref(0)
const cardPosition = ref(-80) // Starting position: 10vh from bottom
const hasMoved = ref(false) // Track if mouse has moved during click
const isAnimating = ref(false) // Track if we're in a toggle animation

function startDrag(event) {
  // Only start drag if clicking specifically on the drag handle
  if (!event.target.closest('.drag-handle')) return

  isDragging.value = true
  hasMoved.value = false
  isAnimating.value = false // Disable animation during drag
  dragStartY.value = event.clientY
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  event.preventDefault()
}

function onDrag(event) {
  if (!isDragging.value) return

  const deltaY = dragStartY.value - event.clientY
  const viewportHeight = window.innerHeight
  const deltaVh = (deltaY / viewportHeight) * 100

  // Mark that we've moved if there's significant movement
  if (Math.abs(deltaVh) > 0.5) {
    hasMoved.value = true
  }

  let newPosition = cardPosition.value + deltaVh

  // Constrain between -80vh (min) and -14vh (max) from bottom
  newPosition = Math.max(-80, Math.min(-14, newPosition))

  cardPosition.value = newPosition
  dragStartY.value = event.clientY
}

function stopDrag() {
  if (isDragging.value && !hasMoved.value) {
    // If we haven't moved, toggle between min and max positions with animation
    isAnimating.value = true
    togglePosition()

    // Reset animation flag after animation completes
    setTimeout(() => {
      isAnimating.value = false
    }, 400) // Match the CSS transition duration
  }

  isDragging.value = false
  hasMoved.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function togglePosition() {
  // If closer to min position (-80), go to max (-14), otherwise go to min
  const currentPos = cardPosition.value
  const midPoint = (-80 + -14) / 2 // -47

  // prefer expression form to satisfy lint rule
  cardPosition.value = currentPos <= midPoint ? -14 : -80
}

// Method to programmatically raise the card
function raiseCard() {
  isAnimating.value = true
  cardPosition.value = -14 // Go to max (top) position

  // Reset animation flag after animation completes
  setTimeout(() => {
    isAnimating.value = false
  }, 400) // Match the CSS transition duration
}

// Expose methods for parent component access
defineExpose({
  raiseCard,
})

// Expand insight
function expandInsight() {
  // When clicked, goes to insight page. If in preview mode, open the "insight/". if in a specific farm, open "insight/[farm_name]"
  // Use router
  if (props.isOverview) {
    router.push('/insight/')
  } else if (props.item && props.item.site_name) {
    const farmName = encodeURIComponent(props.item.site_name)
    router.push(`/insight/${farmName}`)
  }
}

// Initial series = all data (computed from microplasticData)
const chartSeries = computed(() => [
  microplasticData.value.fragments,
  microplasticData.value.fibers,
  microplasticData.value.foams,
  microplasticData.value.films,
  microplasticData.value.pellets,
])

// Separate reactive series for filtering display
const displaySeries = ref([])

// Watch for changes in chartSeries and update displaySeries
watch(chartSeries, newSeries => {
  if (selectedKey.value === null) {
    displaySeries.value = newSeries
  }
}, { immediate: true })

function handleLegendClick(key) {
  // keep local selectedKey in sync and let the MPDonutChart react via prop
  if (selectedKey.value === key) {
    selectedKey.value = null
    onDonutSelection(null)
  } else {
    selectedKey.value = key
    onDonutSelection(key)
  }
}
</script>

<template>
  <div ref="previewCard" :class="['preview-card', { 'no-transition': isDragging || !isAnimating }]" :style="{
    bottom: `${cardPosition}vh`,
    cursor: isDragging ? 'grabbing' : 'default'
  }">
    <!-- Drag Handle -->
    <div class="drag-handle" @mousedown="startDrag">
      <VIcon color="grey-darken-1" size="small">mdi-drag-horizontal</VIcon>
    </div>

    <!-- Card Header -->
    <div class="d-flex flex-column mb-4 card-header">
      <div class="d-flex align-center justify-space-between">
        <h3 class="title">{{ displayTitle }}</h3>
        <VIcon color="grey" size="large" @click="expandInsight">mdi-arrow-expand-all</VIcon>
      </div>
      <p v-if="displaySubtitle" class="subtitle">{{ displaySubtitle }}</p>
    </div>

    <!-- Card Content -->
    <div class="card-content">
      <div class="d-flex align-center mb-4">
        <!-- Average Microplastic Waste per Morphological Category -->
        <MPDonutChart :active-key="selectedKey" :colors="colors" :labels-map="labelsMap"
          :microplastic-data="microplasticData" @selection="onDonutSelection" />
      </div>
      <!-- Contamination Comparison by Farm Practices - Only show in overview mode -->
      <div v-if="props.isOverview || !props.item" class="d-flex flex-column mt-4">
        <MPPracticeBar :options="barChartOptions" :series="barChartDummySeries" subtitle="Data as of September 22, 2025"
          title="Contamination Comparison by Farm Practices" />
      </div>
      <!-- AI Summary -->
      <div class="d-flex flex-column mt-4">
        <div class="d-flex flex-column">
          <div class="d-flex align-center mb-1">
            <h4 class="text-h6 font-weight-bold" style="line-height: 1.2em;">
              AI Summary
            </h4>
            <VIcon class="ml-2" color="primary" size="small">mdi-creation</VIcon>
          </div>
          <p class="subtitle mb-2">Generated on September 22, 2025</p>
          <div class="summary-box">
            <p>{{ aiSummaryText }}</p>
          </div>
        </div>
      </div>
      <div v-if="props.isOverview">
        <h4 class="text-h6 font-weight-bold mt-6 mb-2" style="line-height: 1.2em;">
          Sampled Farms
        </h4>
        <SampledFarms :sampled-sites="allFarmsData" :show-map="false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-card {
  position: fixed;
  right: 20px;
  background: white;
  padding: 1em 1.5em;
  border-radius: 1em 1em 0 0;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.385);
  width: 600px;
  z-index: 1000;
  user-select: none;
  transition: box-shadow 0.2s ease, bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.preview-card.no-transition {
  transition: box-shadow 0.2s ease;
}

.preview-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
}

.drag-handle {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5em;
  margin: -1em -1.5em 1em -1.5em;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 1em 1em 0 0;
  cursor: grab;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s ease;
}

.drag-handle:hover {
  background: rgba(0, 0, 0, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
  background: rgba(0, 0, 0, 0.12);
}

.card-content {
  height: 85vh;
  overflow-y: auto;
  /* remove the scrollbar */
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* Internet Explorer and Edge */
  overflow-x: visible;
  padding-bottom: 10em;
}

.title {
  margin: 0;
  font-weight: bold;
  font-size: 2em;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

.summary-box {
  background-color: #f9f9f9;
  border-left: 4px solid #19568E;
  padding: 1em;
  border-radius: 0em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
