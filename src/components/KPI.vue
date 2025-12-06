<template>
  <div class="kpi-card">
    <div class="kpi-title">{{ title }}</div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="subtitle" class="kpi-subtitle">{{ subtitle }}</div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  subtitle: { type: String, default: '' }
})
</script>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  background: white;
  padding: 16px 20px;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  min-height: 72px;
}

.kpi-title {
  font-size: 18px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 600;
  margin-bottom: 6px;
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.9);
  line-height: 1;
}

.kpi-subtitle {
  margin-top: 6px;
  font-size: 18px;
  color: rgba(0, 0, 0, 0.55);
}
</style>
