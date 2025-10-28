/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

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
app.use(VueApexCharts)
app.component('apexchart', VueApexCharts)

registerPlugins(app)

app.mount('#app')
