<script setup>
  import { onMounted, ref, watch } from 'vue'
  import { ensurePlotOptionsBar, updateApexChart } from '@/composables/useApexChart'

  const props = defineProps({
    options: { type: Object, default: () => ({}) },
    series: { type: Array, default: () => [] },
    type: { type: String, default: 'bar' },
    height: { type: [Number, String], default: 350 },
    remountKey: { type: [Number, String], default: 0 },
    color: { type: [String, Array], default: null },
  })

  const chartRef = ref(null)
  const internalKey = ref(0)

  // expose programmatic control
  function forceRemount () {
    internalKey.value += 1
  }

  async function safeUpdate (redraw = true) {
    const opts = ensurePlotOptionsBar(props.options || {})
    try {
      const ok = await updateApexChart(chartRef, opts, props.series || [], redraw)
      return ok
    } catch {
      // propagate false for caller to decide remount
      return false
    }
  }

  watch([() => props.options, () => props.series], () => {
    // attempt in-place update; ignore errors here
    void safeUpdate(true).then(ok => {
      if (!ok) forceRemount()
    })
  })

  onMounted(() => {
    // try an initial safe update
    void safeUpdate(true)
  })

  defineExpose({ chartRef, forceRemount, safeUpdate })
</script>

<template>
  <apexchart
    :key="remountKey + internalKey"
    ref="chartRef"
    :color="color"
    :height="height"
    :options="options"
    :series="series"
    :type="type"
  />
</template>

<style scoped></style>
