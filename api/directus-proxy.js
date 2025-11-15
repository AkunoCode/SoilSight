/*
  Vercel serverless proxy for Directus

  Purpose: allow the frontend to call a same-origin HTTPS endpoint
  (e.g. /api/directus/items/...) which proxies to an internal Directus
  HTTP endpoint. Configure the internal Directus URL and token via
  environment variables in Vercel: DIRECTUS_INTERNAL_URL and DIRECTUS_INTERNAL_TOKEN.

  Note: keep sensitive tokens in Vercel environment variables (not VITE_*)
*/

export default async function handler(req, res) {
    try {
        const directusBase = process.env.DIRECTUS_INTERNAL_URL || process.env.VITE_DIRECTUS_API_URL
        if (!directusBase) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'DIRECTUS_INTERNAL_URL not configured' }))
            return
        }

        // req.url is like '/api/directus/items/soilsamples?sort=-date_collected'
        // remove the prefix '/api/directus' to reconstruct the target path
        const prefix = '/api/directus'
        const pathAndQuery = req.url.startsWith(prefix) ? req.url.slice(prefix.length) : req.url
        const targetUrl = new URL(pathAndQuery, directusBase).toString()

        // Build headers to forward; do not forward host header
        const headers = {}
        for (const [name, value] of Object.entries(req.headers || {})) {
            // skip 'host' to allow target host to be set correctly
            if (name.toLowerCase() === 'host') continue
            // do not forward 'cookie' by default unless needed
            headers[name] = value
        }

        // If an internal token is configured, add Authorization header (server-side only)
        const internalToken = process.env.DIRECTUS_INTERNAL_TOKEN || process.env.VITE_DIRECTUS_BEARER_TOKEN
        if (internalToken) headers['authorization'] = `Bearer ${internalToken}`

        // Forward the request to Directus
        const fetchOptions = {
            method: req.method,
            headers,
            // For non-GET/HEAD requests, forward the body stream
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
            // follow redirects
            redirect: 'follow',
        }

        const r = await fetch(targetUrl, fetchOptions)

        // pipe status, headers and body back to the client
        res.statusCode = r.status
        r.headers.forEach((value, name) => {
            // skip hop-by-hop headers that Node may not like
            if (name.toLowerCase() === 'transfer-encoding') return
            res.setHeader(name, value)
        })

        const arrayBuffer = await r.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        res.end(buffer)
    } catch (err) {
        console.error('directus-proxy error:', err)
        res.statusCode = 502
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'proxy_error', details: String(err) }))
    }
}
