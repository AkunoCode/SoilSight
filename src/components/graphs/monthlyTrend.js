// Small helper to produce a monthly trend series for all microplastic categories
export function buildMonthlyChartData (totals = {}) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // simple triangular weighting to create a seasonality-like shape
  function distributeAcrossMonths (value) {
    const weights = [0.6, 0.7, 0.9, 1, 1.1, 1.2, 1.2, 1.1, 1, 0.9, 0.8, 0.7]
    const totalW = weights.reduce((a, b) => a + b, 0)
    // if value is falsy or zero, return zeros of same length
    if (!value) {
      return weights.map(() => 0)
    }
    return weights.map(w => Math.round(value * w / totalW))
  }

  const series = [
    { name: 'Fragments', data: distributeAcrossMonths(totals.fragments || 0) },
    { name: 'Fibers', data: distributeAcrossMonths(totals.fibers || 0) },
    { name: 'Foam', data: distributeAcrossMonths(totals.foams || 0) },
    { name: 'Films', data: distributeAcrossMonths(totals.films || 0) },
    { name: 'Pellets', data: distributeAcrossMonths(totals.pellets || 0) },
  ]

  const options = {
    chart: { type: 'line', zoom: { enabled: false }, toolbar: { show: false } },
    xaxis: { categories: months },
    stroke: { curve: 'smooth' },
  }

  return { months, series, options }
}
