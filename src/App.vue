<template>
  <v-app>
    <router-view />
    <SpeedInsights />
  </v-app>
</template>

<script setup>
// SpeedInsights is registered globally via the plugin in `src/main.js`.
  import { SpeedInsights } from '@vercel/speed-insights/vue'
// Mobile-warning is now handled as a dedicated page and by a router guard.
</script>
