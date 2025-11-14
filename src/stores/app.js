// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    // simple loading counter to support concurrent fetches
    loadingCount: 0,
  }),
  getters: {
    loading: (state) => (state.loadingCount || 0) > 0,
  },
  actions: {
    startLoading() {
      this.loadingCount = (this.loadingCount || 0) + 1
    },
    finishLoading() {
      this.loadingCount = Math.max(0, (this.loadingCount || 0) - 1)
    },
    resetLoading() {
      this.loadingCount = 0
    },
  },
})
