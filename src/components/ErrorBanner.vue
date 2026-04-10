<template>
  <div class="error-banner" role="alert">
    <span class="error-banner__icon" aria-hidden="true">⚠</span>
    <span class="error-banner__message">{{ message }}</span>
    <button class="error-banner__retry" data-testid="retry-btn" @click="$emit('retry')">
      Retry
    </button>
  </div>
</template>

<script setup>
defineProps({ message: { type: String, required: true } })
defineEmits(['retry'])
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff8e1;
  border: 1px solid #ffca2c;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.error-banner__icon { font-size: 1.2rem; }
.error-banner__message { flex: 1; color: #664d03; font-weight: 500; }
.error-banner__retry {
  background: #0d6efd;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}
.error-banner__retry:hover { background: #0b5ed7; }
.error-banner__retry:focus-visible { outline: 2px solid #0d6efd; outline-offset: 2px; }
</style>
