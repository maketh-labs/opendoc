import { join, relative } from 'path'
import { unlink, mkdir } from 'fs/promises'
import { readJson, readFormData, resolveInRoot, sendJson, type RouteHandler } from './types'

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
    const form = await readFormData(req)
    const file = form.get('file')
    const pagePath = form.get('pagePath')
    const type = form.get('type')

    if (!(file instanceof File) || typeof type !== 'string' || !VALID_TYPES.includes(type)) {
      sendJson(res, 400, { error: `Missing file or invalid type (${VALID_TYPES.join(' | ')})` })
      return true
    }

    const resolvedDir = await resolveInRoot(ctx.rootDir, typeof pagePath === 'string' ? pagePath : '.')
    if (!resolvedDir) { sendJson(res, 403, { error: 'Forbidden' }); return true }

    await mkdir(resolvedDir, { recursive: true })

    // Remove any existing files of this type
    for (const name of getRecognizedNames(type)) {
      try { await unlink(join(resolvedDir, name)) } catch {}
    }

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const filename = getCanonicalName(type, ext)
    await Bun.write(join(resolvedDir, filename), await file.arrayBuffer())

    const rel = relative(ctx.rootDir, resolvedDir).split(/[\\/]/).filter(Boolean).join('/')
    sendJson(res, 200, { url: rel ? `/${rel}/${filename}` : `/${filename}` })
    return true
  }

  if (req.method === 'DELETE') {
    const { pagePath = '.', type } = await readJson<{ pagePath?: unknown; type?: unknown }>(req)
    if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
      sendJson(res, 400, { error: `Invalid type (${VALID_TYPES.join(' | ')})` })
      return true
    }

    const resolvedDir = await resolveInRoot(ctx.rootDir, typeof pagePath === 'string' ? pagePath : '.')
    if (!resolvedDir) { sendJson(res, 403, { error: 'Forbidden' }); return true }

    for (const name of getRecognizedNames(type)) {
      try { await unlink(join(resolvedDir, name)) } catch {}
    }
    sendJson(res, 200, { ok: true })
    return true
  }

  return false
}
