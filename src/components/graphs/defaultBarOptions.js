export function getDefaultBarOptions(categories = [], overrides = {}) {
  const base = {
    chart: { type: 'bar', height: 300, toolbar: { show: false } },
    colors: ['#19568E', '#63B3FF', '#0B2E4E'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '85%',
        distributed: false,
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: { enabled: true },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: { categories },
    yaxis: { title: { text: 'Number of MP found (in Thousands)' }, min: 0, max: 700 },
    legend: { show: true, position: 'bottom', horizontalAlign: 'left', offsetX: 40 },
    fill: { opacity: 1 },
    tooltip: {
      y: {
        formatter(val) {
          return val + ' thousands'
        },
      },
    },
  }

  // merge overrides into base
  return Object.assign({}, base, overrides, {
    plotOptions: Object.assign({}, base.plotOptions, overrides.plotOptions || {}),
    xaxis: Object.assign({}, base.xaxis, overrides.xaxis || {}),
    yaxis: Object.assign({}, base.yaxis, overrides.yaxis || {}),
    chart: Object.assign({}, base.chart, overrides.chart || {}),
  })
}
