import { readFile, writeFile, unlink } from 'fs/promises'
import { join, extname } from 'path'
import { themeFiles, editorImages } from '../assets'
import { getSettingsPath } from '../config'
import { readJson, resolveInRoot, json, fail, MIME_TYPES, type RouteHandler } from './types'

/** A user-content file response. SVG/HTML get a sandbox CSP so opening them directly can't run script on this origin. */
async function userFile(filePath: string, cacheControl?: string): Promise<Response | null> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) return null
  const ext = extname(filePath).slice(1).toLowerCase()
  const headers: Record<string, string> = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
  }
  if (cacheControl) headers['Cache-Control'] = cacheControl
  return new Response(file, { headers })
}

const SITE_FILE_RE = /\/(favicon(-dark|-96x96)?\.(ico|svg|png)|apple-touch-icon\.png|web-app-manifest-(192x192|512x512)\.png|site\.webmanifest|og-image\.(png|jpg|webp))$/

export const handleStatic: RouteHandler = async (req, url, ctx) => {
  const pathname = url.pathname

  // Theme CSS: base styles + the user's theme.css overrides
  if (pathname === '/_opendoc/theme.css') {
    let css = ctx.styles
    try { css += '\n' + await readFile(join(ctx.rootDir, 'theme.css'), 'utf-8') } catch {}
    return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' } })
  }

  if (pathname === '/_opendoc/theme') {
    const themePath = join(ctx.rootDir, 'theme.css')
    if (req.method === 'GET') {
      const css = await readFile(themePath, 'utf-8').catch(() => '')
      return json({ css })
    }
    if (req.method === 'PUT') {
      const body = await readJson<{ css?: unknown }>(req)
      await writeFile(themePath, typeof body.css === 'string' ? body.css : '', 'utf-8')
      return json({ ok: true })
    }
    if (req.method === 'DELETE') {
      await unlink(themePath).catch(() => {})
      return json({ ok: true })
    }
    return null
  }

  // Client bundle files (built at startup or embedded): /_opendoc/viewer.js, editor.js, editor.css, chunks
  if (pathname.startsWith('/_opendoc/') && /^[\w.-]+\.(js|css)$/.test(pathname.slice('/_opendoc/'.length))) {
    const name = pathname.slice('/_opendoc/'.length)
    const body = ctx.bundles.files[name]
    if (body === undefined) return null
    const type = name.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8'
    return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } })
  }

  // Editor app shell
  if (ctx.editorPath !== null && (pathname === ctx.editorPath || pathname.startsWith(ctx.editorPath + '/') ||
      pathname === getSettingsPath(ctx.editorPath))) {
    return new Response(themeFiles.editorHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // Favicons, manifest and OG images from page directories (not found → fall through to the SPA shell)
  if (SITE_FILE_RE.test(pathname)) {
    const filePath = await resolveInRoot(ctx.rootDir, decodeURIComponent(pathname))
    if (!filePath) return fail(403, 'Forbidden')
    return userFile(filePath, 'no-cache')
  }

  // Editor UI images (embedded in the package/binary)
  if (pathname.startsWith('/_opendoc/assets/')) {
    const assetPath = editorImages[pathname.slice('/_opendoc/assets/'.length)]
    if (!assetPath) return fail(404, 'Not found')
    return new Response(Bun.file(assetPath), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' } })
  }

  // Page assets
  if (pathname.includes('/assets/')) {
    const filePath = await resolveInRoot(ctx.rootDir, decodeURIComponent(pathname))
    if (!filePath) return fail(403, 'Forbidden')
    return (await userFile(filePath)) ?? fail(404, 'Not found')
  }

  // Live reload (dev server)
  if (pathname === '/__reload') return ctx.reload.connect()

  return null
}
