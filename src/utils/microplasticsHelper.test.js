import { describe, expect, it } from 'vitest'
import {
  areaToDiameter,
  calculateTotalMP,
  morphologyIndex,
  sanitizeSiteName,
  siteHasActivity,
  toNumber,
} from './microplasticsHelper.js'

describe('calculateTotalMP', () => {
  it('sums all MP counts from an item', () => {
    const item = { fragment_count: 10, fiber_count: 5, foam_count: 2, film_count: 3, sheets_count: 1 }
    expect(calculateTotalMP(item)).toBe(21)
  })
  it('handles sheets_count variant', () => {
    expect(calculateTotalMP({ sheets_count: 5 })).toBe(5)
  })
  it('handles sheet_count variant', () => {
    expect(calculateTotalMP({ sheet_count: 5 })).toBe(5)
  })
  it('handles sheets variant', () => {
    expect(calculateTotalMP({ sheets: 5 })).toBe(5)
  })
  it('treats null/undefined counts as 0', () => {
    expect(calculateTotalMP({})).toBe(0)
    expect(calculateTotalMP({ fragment_count: null })).toBe(0)
  })
})

describe('morphologyIndex', () => {
  it('returns 0 for fragment', () => expect(morphologyIndex('fragment')).toBe(0))
  it('returns 1 for fiber (case-insensitive)', () => expect(morphologyIndex('Fiber')).toBe(1))
  it('returns 2 for foam', () => expect(morphologyIndex('FOAM')).toBe(2))
  it('returns 3 for film', () => expect(morphologyIndex('film')).toBe(3))
  it('returns 4 for sheet', () => expect(morphologyIndex('sheet')).toBe(4))
  it('returns -1 for unknown shape', () => expect(morphologyIndex('unknown')).toBe(-1))
  it('returns -1 for null', () => expect(morphologyIndex(null)).toBe(-1))
})

describe('sanitizeSiteName', () => {
  it('removes the word Farm', () => expect(sanitizeSiteName('Santos Farm')).toBe('Santos'))
  it('cleans hyphens', () => expect(sanitizeSiteName('Site-A')).toBe('Site A'))
  it('handles null', () => expect(sanitizeSiteName(null)).toBe(''))
  it('handles undefined', () => expect(sanitizeSiteName(undefined)).toBe(''))
})

describe('siteHasActivity', () => {
  it('returns true when activity is in array', () => {
    const site = { plastic_activity: ['Plastic Mulching', 'Fertilizer Sacks'] }
    expect(siteHasActivity(site, 'Plastic Mulching')).toBe(true)
  })
  it('returns true when activity is in string', () => {
    const site = { plastic_activity: 'Plastic Mulching' }
    expect(siteHasActivity(site, 'plastic mulching')).toBe(true)
  })
  it('returns false when activity is absent', () => {
    const site = { plastic_activity: ['Fertilizer Sacks'] }
    expect(siteHasActivity(site, 'Plastic Mulching')).toBe(false)
  })
  it('returns false for null site', () => {
    expect(siteHasActivity(null, 'anything')).toBe(false)
  })
})

describe('toNumber', () => {
  it('converts numeric strings', () => expect(toNumber('42')).toBe(42))
  it('returns NaN for null', () => expect(Number.isNaN(toNumber(null))).toBe(true))
  it('returns NaN for empty string', () => expect(Number.isNaN(toNumber(''))).toBe(true))
})

describe('areaToDiameter', () => {
  it('converts area to diameter correctly', () => {
    const area = Math.PI * 25 // r=5 → d=10
    expect(areaToDiameter(area)).toBeCloseTo(10)
  })
  it('returns NaN for zero', () => expect(Number.isNaN(areaToDiameter(0))).toBe(true))
  it('returns NaN for negative', () => expect(Number.isNaN(areaToDiameter(-1))).toBe(true))
})
