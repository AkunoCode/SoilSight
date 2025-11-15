<template>
  <v-app>
    <router-view />
    <div id="speed-insights" style="position:fixed;right:1rem;bottom:1rem;z-index:9999;">
      <SpeedInsights />
    </div>
  </v-app>
</template>

<script setup>
// SpeedInsights is registered globally via the plugin in `src/main.js`.
</script>
