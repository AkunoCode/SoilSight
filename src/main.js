/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

import { SpeedInsights } from '@vercel/speed-insights/vue'

// Composables
import { createApp } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

// Plugins
import { registerPlugins } from '@/plugins'
// Components
import App from './App.vue'

// Styles
import 'unfonts.css'

const app = createApp(App)
// vue3-apexcharts registers itself when used as a plugin. Only call use here to install it.
app.use(VueApexCharts)
// Register Vercel Speed Insights plugin
app.use(SpeedInsights)

registerPlugins(app)

app.mount('#app')
