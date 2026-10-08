import type { RouteHandler } from './types'
import { fetchPublicText } from '../security'

export const handleFetchMeta: RouteHandler = async (req, res, url, _ctx) => {
  if (url.pathname !== '/_opendoc/fetch-meta' || req.method !== 'GET') return false

  const urlParam = url.searchParams.get('url')
  if (!urlParam) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing url param' }))
    return true
  }

  try {
    const { url: finalUrl, text: html } = await fetchPublicText(urlParam, {
      maxBytes: 512 * 1024,
      headers: { 'User-Agent': 'OpenDocBot/1.0 (link preview)' },
    })

    function getMeta(prop: string): string {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
      return m?.[1] ?? ''
    }
    function getTag(tag: string): string {
      const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
      return m?.[1]?.trim() ?? ''
    }

    const parsed = finalUrl
    const origin = parsed.origin
    const domain = parsed.hostname.replace(/^www\./, '')

    const title = getMeta('og:title') || getMeta('twitter:title') || getTag('title') || domain
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || ''
    const rawImage = getMeta('og:image') || getMeta('twitter:image') || ''
    const imageUrl = (() => {
      try {
        const u = new URL(rawImage, parsed)
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
      } catch { return '' }
    })()
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
