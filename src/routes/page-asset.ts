import { join, resolve } from 'path'
import { unlink, mkdir } from 'fs/promises'
import { readBodyRaw, isWithinRoot, type RouteHandler } from './types'

const ASSET_DEFS: Record<string, { recognized: string[]; canonical: string }> = {
  'favicon-96x96':        { recognized: ['favicon-96x96.png'],                              canonical: 'favicon-96x96.png' },
  'favicon-svg':          { recognized: ['favicon.svg'],                                    canonical: 'favicon.svg' },
  'favicon-ico':          { recognized: ['favicon.ico'],                                    canonical: 'favicon.ico' },
  'apple-touch-icon':     { recognized: ['apple-touch-icon.png'],                           canonical: 'apple-touch-icon.png' },
  'web-app-manifest-192': { recognized: ['web-app-manifest-192x192.png'],                   canonical: 'web-app-manifest-192x192.png' },
  'web-app-manifest-512': { recognized: ['web-app-manifest-512x512.png'],                   canonical: 'web-app-manifest-512x512.png' },
  'site-webmanifest':     { recognized: ['site.webmanifest'],                               canonical: 'site.webmanifest' },
  'favicon':              { recognized: ['favicon.ico', 'favicon.svg', 'favicon.png'],      canonical: 'favicon.png' },
  'favicon-dark':         { recognized: ['favicon-dark.png', 'favicon-dark.svg'],           canonical: 'favicon-dark.png' },
  'og-image':             { recognized: ['og-image.png', 'og-image.jpg', 'og-image.webp'], canonical: 'og-image.png' },
}

const VALID_TYPES = Object.keys(ASSET_DEFS)

function getRecognizedNames(type: string): string[] {
  return ASSET_DEFS[type]?.recognized ?? []
}

function getCanonicalName(type: string, fallbackExt: string): string {
  return ASSET_DEFS[type]?.canonical ?? `${type}.${fallbackExt}`
}

export const handlePageAsset: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/page-asset') return false

  if (req.method === 'POST') {
    try {
      const rawBody = await readBodyRaw(req)
      const bunReq = new Request('http://localhost/_opendoc/page-asset', {
        method: 'POST',
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(([, v]) => v !== undefined) as [string, string][]
        ),
        body: rawBody.buffer as ArrayBuffer,
      })
      const form = await bunReq.formData()
      const file = form.get('file') as File | null
      const pagePath = (form.get('pagePath') as string | null) ?? '.'
      const type = (form.get('type') as string | null) ?? ''

      if (!file || !VALID_TYPES.includes(type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Missing file or invalid type (${VALID_TYPES.join(' | ')})` }))
        return true
      }

      const pageDir = pagePath === '.' ? ctx.rootDir : join(ctx.rootDir, pagePath)
      const resolvedDir = resolve(pageDir)
      if (!isWithinRoot(ctx.rootDir, resolvedDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Forbidden' }))
        return true
      }

      await mkdir(resolvedDir, { recursive: true })

      // Remove any existing files of this type
      const recognized = getRecognizedNames(type)
      for (const name of recognized) {
        try { await unlink(join(resolvedDir, name)) } catch {}
      }

      // Determine extension from uploaded file
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const filename = getCanonicalName(type, ext)
      const filePath = join(resolvedDir, filename)
      await Bun.write(filePath, await file.arrayBuffer())

      const urlPath = pagePath === '.' ? `/${filename}` : `/${pagePath}/${filename}`
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ url: urlPath }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e) }))
    }
    return true
  }

  if (req.method === 'DELETE') {
    try {
      const { pagePath = '.', type } = JSON.parse((await readBodyRaw(req)).toString('utf-8'))

      if (!VALID_TYPES.includes(type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Invalid type (${VALID_TYPES.join(' | ')})` }))
        return true
      }

      const pageDir = pagePath === '.' ? ctx.rootDir : join(ctx.rootDir, pagePath)
      const resolvedDir = resolve(pageDir)
      if (!isWithinRoot(ctx.rootDir, resolvedDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Forbidden' }))
        return true
      }

      const recognized = getRecognizedNames(type)
      for (const name of recognized) {
        try { await unlink(join(resolvedDir, name)) } catch {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e) }))
    }
    return true
  }

  return false
}
