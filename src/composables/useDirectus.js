import { createDirectus, rest } from '@directus/sdk'

// All requests go through the server-side proxy at /api/directus which
// handles authentication and forwards to the actual Directus instance.
// This avoids exposing tokens in the client bundle and prevents
// mixed-content errors (the Directus instance is HTTP).
let apiUrl = '/api/directus'

if (typeof window !== 'undefined') {
  apiUrl = new URL(apiUrl, window.location.origin).toString()
}

const directus = createDirectus(apiUrl).with(rest())

export default directus
