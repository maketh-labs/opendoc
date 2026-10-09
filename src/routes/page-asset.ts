import { join } from 'path'
import { unlink, mkdir } from 'fs/promises'
import { readJson, resolveInRoot, json, fail, type RouteHandler } from './types'
import { readPageUpload } from './upload'

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

export const handlePageAsset: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/page-asset') return null

  if (req.method === 'POST') {
    const { form, file, pageDir, pageUrl } = await readPageUpload(req, ctx.rootDir)
    const type = form.get('type')
    if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
      return fail(400, `Invalid type (${VALID_TYPES.join(' | ')})`)
    }

    await mkdir(pageDir, { recursive: true })
    // Replace any existing file of this type
    for (const name of getRecognizedNames(type)) {
      try { await unlink(join(pageDir, name)) } catch {}
    }

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const filename = getCanonicalName(type, ext)
    await Bun.write(join(pageDir, filename), file)
    return json({ url: `${pageUrl}/${filename}` })
  }

  if (req.method === 'DELETE') {
    const { pagePath = '.', type } = await readJson<{ pagePath?: unknown; type?: unknown }>(req)
    if (typeof type !== 'string' || !VALID_TYPES.includes(type)) {
      return fail(400, `Invalid type (${VALID_TYPES.join(' | ')})`)
    }
    const pageDir = await resolveInRoot(ctx.rootDir, typeof pagePath === 'string' ? pagePath : '.')
    if (!pageDir) return fail(403, 'Forbidden')

    for (const name of getRecognizedNames(type)) {
      try { await unlink(join(pageDir, name)) } catch {}
    }
    return json({ ok: true })
  }

  return null
}
