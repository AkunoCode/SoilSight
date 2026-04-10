import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { calculateTotalMP } from '@/utils/microplasticsHelper.js'
import { useMapMarkers } from './useMapMarkers.js'

vi.mock('@/utils/microplasticsHelper.js', () => ({
  calculateTotalMP: vi.fn(() => 10),
}))

// Leaflet cannot run in Node — mock it before importing the composable
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    marker: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), _item: null })),
  },
}))

describe('useMapMarkers', () => {
  describe('getMarkerColor', () => {
    it('returns orange for integrated', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('Integrated Practice')).toBe('#FF9800')
    })
    it('returns green for organic', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('Organic')).toBe('#4CAF50')
    })
    it('returns blue for conventional', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('conventional')).toBe('#19568E')
    })
    it('returns grey for unknown practice', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor('something else')).toBe('#757575')
    })
    it('returns grey for null', () => {
      const { getMarkerColor } = useMapMarkers(ref([]), ref(null))
      expect(getMarkerColor(null)).toBe('#757575')
    })
  })

  describe('clearMarkers', () => {
    it('empties markersRef', () => {
      const mapRef = ref({ removeLayer: vi.fn() })
      const { markersRef, clearMarkers } = useMapMarkers(ref([]), mapRef)
      markersRef.value = [{ id: 1 }, { id: 2 }]
      clearMarkers()
      expect(markersRef.value).toHaveLength(0)
    })
  })

  describe('addMarkers', () => {
    it('calls calculateTotalMP once per farm for range calc, not N times per farm', () => {
      const farms = [
        { latitude: 10, longitude: 10, cultivation_practice: 'organic' },
        { latitude: 11, longitude: 11, cultivation_practice: 'organic' },
      ]
      const mapRef = ref({
        removeLayer: vi.fn(),
      })
      const { addMarkers } = useMapMarkers(ref(farms), mapRef)

      calculateTotalMP.mockClear()
      addMarkers(farms)

      // With 2 farms: range calc = 2 calls, marker size calc = 2 calls → total 4, not 2*2+2=6
      expect(calculateTotalMP).toHaveBeenCalledTimes(4)
    })
  })
})
