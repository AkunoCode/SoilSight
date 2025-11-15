import { createDirectus, rest, staticToken } from '@directus/sdk'

// Choose API URL safely for browser environments to avoid mixed-content errors.
// Prefer a secure HTTPS VITE_DIRECTUS_API_URL when provided. If the configured
// URL is insecure (http) or not set, fall back to the serverless proxy
// endpoint at `/api/directus` which can be configured on the deployment
// platform (Vercel) to forward requests to the internal Directus instance.
const configuredUrl = import.meta.env.VITE_DIRECTUS_API_URL
const configuredToken = import.meta.env.VITE_DIRECTUS_BEARER_TOKEN

let apiUrl = '/api/directus'
let useProxy = true

if (configuredUrl) {
  try {
    const lowered = configuredUrl.toLowerCase()
    if (lowered.startsWith('https://')) {
      apiUrl = configuredUrl
      useProxy = false
    } else {
      // Insecure or non-https URL — warn and keep proxy fallback
      // This prevents mixed-content errors when the site is served over HTTPS.
      // The proxy should be configured server-side to forward to the insecure backend.
      // eslint-disable-next-line no-console
      console.warn('VITE_DIRECTUS_API_URL is not HTTPS; using /api/directus proxy to avoid mixed-content.')
      apiUrl = '/api/directus'
      useProxy = true
    }
  } catch (err) {
    // If parsing fails, default to proxy
    apiUrl = '/api/directus'
    useProxy = true
  }
}

// Build the Directus client. If we're using the proxy (server-side token),
// do NOT attach the static token on the client — the proxy will add it.
let directus = createDirectus(apiUrl).with(rest())
if (!useProxy && configuredToken) {
  directus = directus.with(staticToken(configuredToken))
}

export default directus
