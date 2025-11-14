<template>
  <v-main>
    <router-view />
    <LoadingOverlay />
  </v-main>
</template>

<script setup>
import LoadingOverlay from '@/components/LoadingOverlay.vue'
</script>
