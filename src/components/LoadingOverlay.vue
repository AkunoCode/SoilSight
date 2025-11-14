<template>
    <div v-if="store.loading" class="loading-overlay">
        <div class="loading-box">
            <VProgressCircular indeterminate color="primary" size="48" />
            <p class="loading-text">Loading data…</p>
        </div>
    </div>
</template>

<script setup>
import { useAppStore } from '@/stores/app'
const store = useAppStore()
</script>

<style scoped>
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.75);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 28px;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.loading-text {
    margin: 0;
    color: #333;
    font-weight: 600;
}
</style>