/*
  Vercel serverless proxy for Directus
  Fixed for Vercel body parsing behavior
*/

export default async function handler (req, res) {
  try {
    const directusBase = process.env.DIRECTUS_URL
    if (!directusBase) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'DIRECTUS_URL not configured' }))
      return
    }

    // 1. Construct URL
    const prefix = '/api/directus'
    const pathAndQuery = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url
    // Ensure no double slashes if directusBase has trailing slash
    const baseUrl = directusBase.endsWith('/') ? directusBase.slice(0, -1) : directusBase
    const targetUrl = new URL(pathAndQuery, baseUrl).toString()

    // 2. Prepare Headers
    const headers = {}
    for (const [name, value] of Object.entries(req.headers || {})) {
      const lowerName = name.toLowerCase()
      // Remove headers that cause conflicts or are handled by fetch automatically
      if (['host', 'content-length', 'connection', 'transfer-encoding'].includes(lowerName)) {
        continue
      }
      headers[name] = value
    }

    // Force Content-Type to JSON if it's missing, as we are sending JSON
    if (!headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    // Add Auth Token
    const internalToken = process.env.DIRECTUS_TOKEN
    if (internalToken) {
      headers['authorization'] = `Bearer ${internalToken}`
    }

    // 3. Handle Body (The Fix)
    let body = undefined
    if (!['GET', 'HEAD'].includes(req.method)) {
      // Vercel parses JSON body automatically into req.body
      if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body)
      } else {
        // Fallback if body wasn't parsed or is a string
        body = req.body
      }

      // CRITICAL: If body is empty on a POST, send empty JSON object
      if (!body && req.method === 'POST') {
        body = '{}'
      }
    }

    // 4. Fetch
    const r = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    })

    // 5. Return Response
    res.statusCode = r.status
    for (const [name, value] of r.headers.entries()) {
      if (name.toLowerCase() === 'transfer-encoding') {
        continue
      }
      // directus sometimes returns chunked, let node handle that
      if (name.toLowerCase() === 'content-encoding') {
        continue
      }
      res.setHeader(name, value)
    }

    const arrayBuffer = await r.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    res.end(buffer)
  } catch (error) {
    console.error('directus-proxy error:', error)
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      error: 'proxy_error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }))
  }
}
