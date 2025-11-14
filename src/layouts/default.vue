<template>
  <div class="layout-root">
    <v-main>
      <router-view />
    </v-main>
    <!-- place LoadingOverlay as a sibling to v-main so its fixed positioning covers the full document -->
    <LoadingOverlay />
  </div>
</template>

<script setup>
import LoadingOverlay from '@/components/LoadingOverlay.vue'
</script>
