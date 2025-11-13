import { createDirectus, rest, staticToken } from '@directus/sdk'

const apiUrl = import.meta.env.VITE_DIRECTUS_API_URL
const token = import.meta.env.VITE_DIRECTUS_BEARER_TOKEN

const directus = createDirectus(apiUrl)
  .with(staticToken(token))
  .with(rest())

export default directus
