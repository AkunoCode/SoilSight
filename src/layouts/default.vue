<template>
  <div class="layout-root">
    <v-main>
      <router-view />
    </v-main>
    <LoadingOverlay />
  </div>
</template>

<script setup>
import LoadingOverlay from '@/components/LoadingOverlay.vue'
</script>
