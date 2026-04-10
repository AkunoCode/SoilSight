import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

// Leaflet cannot run in Node — mock it before importing the composable
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    marker:  vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), _item: null })),
  },
}))

import { useMapMarkers } from './useMapMarkers.js'

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
})
