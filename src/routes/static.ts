import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, resolve } from 'path'
import type { RouteHandler } from './types'

export const handleStatic: RouteHandler = async (req, res, url, ctx) => {
  const pathname = url.pathname

    // Serve theme CSS (base styles + user overrides)
  if (pathname === '/_opendoc/theme.css') {
    let css = ctx.getStyles()
    try {
      const userTheme = await readFile(join(ctx.rootDir, '.opendoc', 'theme.css'), 'utf-8')
      if (userTheme) css += '\n' + userTheme
    } catch {}
    res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' })
    res.end(css)
    return true
  }

  // Save user theme overrides
  if (pathname === '/_opendoc/theme' && req.method === 'PUT') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
    const dir = join(ctx.rootDir, '.opendoc')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'theme.css'), body.css || '', 'utf-8')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  // Get user theme overrides
  if (pathname === '/_opendoc/theme' && req.method === 'GET') {
    try {
      const css = await readFile(join(ctx.rootDir, '.opendoc', 'theme.css'), 'utf-8')
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
      const { unlink } = await import('fs/promises')
      await unlink(join(ctx.rootDir, '.opendoc', 'theme.css'))
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  // Serve highlight.js CSS
  if (pathname === '/_opendoc/hljs-light.css' || pathname === '/_opendoc/hljs-dark.css') {
    const file = pathname === '/_opendoc/hljs-light.css' ? 'hljs-github.css' : 'hljs-github-dark.css'
    try {
      const css = await readFile(join(ctx.projectRoot, 'themes', 'default', file), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=86400' })
      res.end(css)
    } catch {
      res.writeHead(404); res.end()
    }
    return true
  }

  // Serve viewer bundle JS — built at startup
  if (pathname === '/client/viewer.tsx' || pathname === '/client/viewer.ts') {
    const js = ctx.getViewerBundleJs()
    if (!js) { res.writeHead(503, { 'Content-Type': 'text/plain' }); res.end('Viewer bundle not ready'); return true }
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' })
    res.end(js)
    return true
  }

  // Editor route (HTML page)
  if (ctx.editorPath !== null && (pathname === ctx.editorPath || pathname.startsWith(ctx.editorPath + '/'))) {
    const editorFilePath = join(ctx.projectRoot, 'themes', 'default', 'editor.html')
    try {
      const editorHtml = await readFile(editorFilePath, 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(editorHtml)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' })
      res.end('<h1>Editor not found</h1>')
    }
    return true
  }

  // Serve editor bundle JS — built at startup, always ready
  if (pathname === '/client/editor.tsx' || pathname === '/client/editor.ts') {
    const js = ctx.getEditorBundleJs()
    if (!js) { res.writeHead(503, { 'Content-Type': 'text/plain' }); res.end('Editor bundle not ready'); return true }
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' })
    res.end(js)
    return true
  }

  // Serve editor CSS — built at startup, always ready
  if (pathname === '/client/editor.css') {
    const css = ctx.getEditorBundleCss()
    if (!css) { res.writeHead(503, { 'Content-Type': 'text/plain' }); res.end('Editor CSS not ready'); return true }
    res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' })
    res.end(css)
    return true
  }

  // Serve favicon and og-image files from page directories
  if (/\/(favicon\.(ico|svg|png)|og-image\.(png|jpg|webp))$/.test(pathname)) {
    const filePath = resolve(ctx.rootDir, pathname.replace(/^\//, ''))
    if (!filePath.startsWith(resolve(ctx.rootDir) + '/') && filePath !== resolve(ctx.rootDir)) {
      res.writeHead(403); res.end('Forbidden')
      return true
    }
    try {
      const data = await Bun.file(filePath).arrayBuffer()
      const ext = pathname.split('.').pop()?.toLowerCase()
      const mimeTypes: Record<string, string> = {
        ico: 'image/x-icon', svg: 'image/svg+xml', png: 'image/png',
        jpg: 'image/jpeg', webp: 'image/webp',
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
      res.end(Buffer.from(data))
    } catch {
      // Fall through — not found, let other handlers try
      return false
    }
    return true
  }

  // Serve assets from page directories
  if (pathname.includes('/assets/')) {
    const filePath = resolve(ctx.rootDir, pathname.replace(/^\//, ''))
    if (!filePath.startsWith(resolve(ctx.rootDir) + '/')) {
      res.writeHead(403); res.end('Forbidden')
      return true
    }
    try {
      const data = await Bun.file(filePath).arrayBuffer()
      const ext = pathname.split('.').pop()?.toLowerCase()
      const mimeTypes: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
        pdf: 'application/pdf',
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream' })
      res.end(Buffer.from(data))
    } catch {
      res.writeHead(404); res.end('Not found')
    }
    return true
  }

  // Serve dist files
  if (pathname.startsWith('/dist/')) {
    const distPath = join(ctx.rootDir, '.opendoc', pathname.slice(1))
    try {
      const content = await readFile(distPath, 'utf-8')
      const ext = pathname.split('.').pop()
      const contentType = ext === 'json' ? 'application/json' : 'text/plain'
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    } catch {
      res.writeHead(404); res.end('Not found')
    }
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
