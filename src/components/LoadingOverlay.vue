<template>
  <Transition name="overlay">
    <div v-if="store.loading" class="loading-overlay">
      <div class="loading-card">
        <div class="loading-icon">
          <VIcon color="primary" size="32">mdi-sprout</VIcon>
        </div>
        <div class="loading-dots">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
        <p class="loading-label">Loading data</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
  import { watch } from 'vue'
  import { useAppStore } from '@/stores/app'
  const store = useAppStore()

  watch(() => store.loading, val => {
    try {
      document.body.classList.toggle('loading-active', val)
    } catch {
    // ignore in SSR
    }
  }, { immediate: true })
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(242, 242, 248, 0.75);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.loading-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(54, 110, 206, 0.08);
  animation: pulse-ring 2s ease-in-out infinite;
}

.loading-dots {
  display: flex;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #366ECE;
  animation: bounce 1.2s ease-in-out infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

.loading-label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #555;
  letter-spacing: 0.02em;
}

/* entrance / exit */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%            { transform: translateY(-8px); opacity: 1; }
}

@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(54, 110, 206, 0.15); }
  50%       { box-shadow: 0 0 0 10px rgba(54, 110, 206, 0); }
}
</style>

<style>
.loading-active { overflow: hidden !important; }
</style>
