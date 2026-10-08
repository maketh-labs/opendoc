import { readFile, writeFile, unlink } from 'fs/promises'
import { themeFiles, editorImages } from '../assets'
import { join, extname } from 'path'
import { readJson, resolveInRoot, MIME_TYPES, type RouteHandler } from './types'
import type { ServerResponse } from 'http'

/** Serve a user-content file. SVG/HTML get a sandbox CSP so opening them directly can't run script on this origin. */
async function sendUserFile(res: ServerResponse, filePath: string, cacheControl?: string): Promise<boolean> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) return false
  const ext = extname(filePath).slice(1).toLowerCase()
  const headers: Record<string, string> = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
  }
  if (cacheControl) headers['Cache-Control'] = cacheControl
  res.writeHead(200, headers)
  res.end(Buffer.from(await file.arrayBuffer()))
  return true
}

export const handleStatic: RouteHandler = async (req, res, url, ctx) => {
  const pathname = url.pathname

    // Serve theme CSS (base styles + user overrides)
  if (pathname === '/_opendoc/theme.css') {
    let css = ctx.getStyles()
    try {
      const userTheme = await readFile(join(ctx.rootDir, 'theme.css'), 'utf-8')
      if (userTheme) css += '\n' + userTheme
    } catch {}
    res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' })
    res.end(css)
    return true
  }

  // Save user theme overrides
  if (pathname === '/_opendoc/theme' && req.method === 'PUT') {
    const body = await readJson<{ css?: unknown }>(req)
    await writeFile(join(ctx.rootDir, 'theme.css'), typeof body.css === 'string' ? body.css : '', 'utf-8')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  // Get user theme overrides
  if (pathname === '/_opendoc/theme' && req.method === 'GET') {
    try {
      const css = await readFile(join(ctx.rootDir, 'theme.css'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ css }))
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ css: '' }))
    }
    return true
  }

  // Delete user theme overrides
  if (pathname === '/_opendoc/theme' && req.method === 'DELETE') {
    try {
      await unlink(join(ctx.rootDir, 'theme.css'))
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  // Client bundles (built at startup or embedded). /client/* are legacy aliases.
  const bundle = (() => {
    switch (pathname) {
      case '/_opendoc/viewer.js': case '/client/viewer.tsx': return { body: ctx.bundles.viewerJs, type: 'application/javascript' }
      case '/_opendoc/editor.js': case '/client/editor.tsx': return { body: ctx.bundles.editorJs, type: 'application/javascript' }
      case '/_opendoc/editor.css': case '/client/editor.css': return { body: ctx.bundles.editorCss, type: 'text/css' }
    }
    return undefined
  })()
  if (bundle !== undefined) {
    if (!bundle.body) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return true }
    res.writeHead(200, { 'Content-Type': `${bundle.type}; charset=utf-8`, 'Cache-Control': 'no-cache' })
    res.end(bundle.body)
    return true
  }

  // Editor route (HTML page)
  if (ctx.editorPath !== null && (pathname === ctx.editorPath || pathname.startsWith(ctx.editorPath + '/'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(themeFiles.editorHtml)
    return true
  }

  // Serve favicon and og-image files from page directories
  if (/\/(favicon(-dark|-96x96)?\.(ico|svg|png)|apple-touch-icon\.png|web-app-manifest-(192x192|512x512)\.png|site\.webmanifest|og-image\.(png|jpg|webp))$/.test(pathname)) {
    const filePath = await resolveInRoot(ctx.rootDir, decodeURIComponent(pathname))
    if (!filePath) { res.writeHead(403); res.end('Forbidden'); return true }
    // Not found — fall through so other handlers (and the SPA shell) can respond
    return sendUserFile(res, filePath, 'no-cache')
  }

  // Editor UI images (embedded in the package/binary)
  if (pathname.startsWith('/_opendoc/assets/')) {
    const assetPath = editorImages[pathname.slice('/_opendoc/assets/'.length)]
    if (!assetPath) { res.writeHead(404); res.end('Not found'); return true }
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' })
    res.end(Buffer.from(await Bun.file(assetPath).arrayBuffer()))
    return true
  }

  // Serve assets from page directories
  if (pathname.includes('/assets/')) {
    const filePath = await resolveInRoot(ctx.rootDir, decodeURIComponent(pathname))
    if (!filePath) { res.writeHead(403); res.end('Forbidden'); return true }
    if (!(await sendUserFile(res, filePath))) { res.writeHead(404); res.end('Not found') }
    return true
  }

  // SSE endpoint for hot reload
  if (pathname === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    ctx.reloadClients.add(res)
    req.on('close', () => ctx.reloadClients.delete(res))
    return true
  }

  return false
}
