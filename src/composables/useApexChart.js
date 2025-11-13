// Small helper utilities for working with ApexCharts instances in Vue components
export function safeColorArray (colors) {
  if (!colors) {
    return []
  }
  try {
    if (Array.isArray(colors)) {
      return colors.map(c => c || '#9e9e9e')
    }
    if (typeof colors === 'object') {
      return Object.values(colors).map(c => c || '#9e9e9e')
    }
  } catch {
    return []
  }
  return []
}

export async function updateApexChart (chartRef, options, series, redraw = true) {
  // Support multiple shapes: a ref (with .value), a wrapper/component exposing .chartRef,
  // or a direct instance with updateOptions/updateSeries.
  if (!chartRef) {
    return false
  }
  let inst = null
  try {
    if (chartRef.value !== undefined) {
      // a ref-wrapped instance or a ref to the component
      inst = chartRef.value
    } else if (chartRef.chartRef === undefined) {
      // maybe a direct instance
      inst = chartRef
    } else {
      // a component instance exposing chartRef (which itself might be a ref)
      const inner = chartRef.chartRef
      inst = inner?.value ?? inner
    }

    if (!inst) {
      return false
    }

    if (options && typeof inst.updateOptions === 'function') {
      inst.updateOptions(options, false, redraw)
    }
    if (series && typeof inst.updateSeries === 'function') {
      inst.updateSeries(series, redraw)
    }
    return true
  } catch {
    // If update fails, return false so caller can decide to remount
    // Keep this quiet in production usage but log during development
    // console.warn('updateApexChart failed', e)
    return false
  }
}

export function ensurePlotOptionsBar (options) {
  if (!options) {
    return options
  }
  options.plotOptions = Object.assign({}, options.plotOptions || {})
  options.plotOptions.bar = Object.assign({}, options.plotOptions.bar || {})
  return options
}
