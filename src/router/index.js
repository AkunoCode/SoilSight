/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

import { setupLayouts } from 'virtual:generated-layouts'
// Composables
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { MOBILE_BREAKPOINT_PX } from '@/config/constants.js'

// Add a guard to force small-screen users to the mobile-warning page (non-dismissible)
function isSmallScreen () {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: setupLayouts(routes),
})

// Global guard: on small screens redirect everything to the mobile warning page.
router.beforeEach((to, from, next) => {
  try {
    if (isSmallScreen() && to.fullPath !== '/mobile-warning') {
      return next({ path: '/mobile-warning' })
    }
  } catch (error) {
    // if anything goes wrong, don't block navigation
    console.error('mobile-warning guard error', error)
  }
  return next()
})

// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
  if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
    if (localStorage.getItem('vuetify:dynamic-reload')) {
      console.error('Dynamic import error, reloading page did not fix it', err)
    } else {
      console.log('Reloading page to fix dynamic import error')
      localStorage.setItem('vuetify:dynamic-reload', 'true')
      location.assign(to.fullPath)
    }
  } else {
    console.error(err)
  }
})

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload')
})

export default router
