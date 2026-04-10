/**
 * Pure utility functions for microplastic data.
 * No Vue reactivity — safe to import anywhere.
 */

/**
 * Returns the total microplastic count for a site or sample item.
 * Handles all known field name variants for the sheets type.
 */
export function calculateTotalMP (item) {
  return (
    (Number(item.fragment_count) || 0)
    + (Number(item.fiber_count) || 0)
    + (Number(item.foam_count) || 0)
    + (Number(item.film_count) || 0)
    + (Number(item.sheets_count) || Number(item.sheet_count) || Number(item.sheets) || 0)
  )
}

/**
 * Maps a morphology/shape string to its array index [0–4].
 * Used to index into drilldown arrays: [fragments, fibers, foam, films, sheets].
 * Returns -1 for unrecognised shapes.
 */
export function morphologyIndex (shape) {
  const m = (shape || '').toString().toLowerCase()
  if (m.includes('fragment')) {
    return 0
  }
  if (m.includes('fiber')) {
    return 1
  }
  if (m.includes('foam')) {
    return 2
  }
  if (m.includes('film')) {
    return 3
  }
  if (m.includes('sheet')) {
    return 4
  }
  return -1
}

/**
 * Strips "Farm" word and separator characters from a site name.
 * e.g. "Santos Farm" → "Santos", "Site-A" → "Site A"
 */
export function sanitizeSiteName (name) {
  return String(name || '')
    .replace(/\b[Ff]arm\b/g, '')
    .replace(/[-–—_/]+/g, ' ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '')
}

/**
 * Returns true if the site's plastic_activity field contains the expected string.
 * Handles both array and string values for plastic_activity.
 */
export function siteHasActivity (site, expected) {
  if (!site || !site.plastic_activity) {
    return false
  }
  const raw = site.plastic_activity
  const norm = (expected || '').toString().toLowerCase().trim()
  if (Array.isArray(raw)) {
    return raw.some(x => String(x).toLowerCase().includes(norm))
  }
  return String(raw).toLowerCase().includes(norm)
}

/**
 * Safe Number() coercion — returns NaN for null, undefined, or empty string.
 */
export function toNumber (v) {
  if (v == null || v === '') {
    return Number.NaN
  }
  const n = Number(v)
  return Number.isNaN(n) ? Number.NaN : n
}

/**
 * Converts an area in µm² to an equivalent circular diameter in µm.
 */
export function areaToDiameter (area) {
  if (!Number.isFinite(area) || area <= 0) {
    return Number.NaN
  }
  return 2 * Math.sqrt(area / Math.PI)
}
