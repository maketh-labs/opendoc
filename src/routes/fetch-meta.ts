import type { RouteHandler } from './types'

export const handleFetchMeta: RouteHandler = async (req, res, url, _ctx) => {
  if (url.pathname !== '/_opendoc/fetch-meta' || req.method !== 'GET') return false

  const urlParam = url.searchParams.get('url')
  if (!urlParam) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing url param' }))
    return true
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const r = await fetch(urlParam, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OpenDocBot/1.0 (link preview)' },
    })
    clearTimeout(timeout)
    const html = await r.text()

    function getMeta(prop: string): string {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
      return m?.[1] ?? ''
    }
    function getTag(tag: string): string {
      const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
      return m?.[1]?.trim() ?? ''
    }

    const parsed = new URL(urlParam)
    const origin = parsed.origin
    const domain = parsed.hostname.replace(/^www\./, '')

    const title = getMeta('og:title') || getMeta('twitter:title') || getTag('title') || domain
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || ''
    const imageUrl = getMeta('og:image') || getMeta('twitter:image') || ''
    const favicon = `${origin}/favicon.ico`

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ title, description, imageUrl, favicon, domain, url: urlParam }))
  } catch {
    const domain = (() => { try { return new URL(urlParam).hostname.replace(/^www\./, '') } catch { return urlParam } })()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ title: domain, description: '', imageUrl: '', favicon: '', domain, url: urlParam }))
  }
  return true
}
