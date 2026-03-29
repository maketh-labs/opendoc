import { readFile } from 'fs/promises'
import { join } from 'path'
import type { RouteHandler } from './types'

export const handleStatic: RouteHandler = async (req, res, url, ctx) => {
  const pathname = url.pathname

  // Serve theme CSS
  if (pathname === '/_opendoc/theme.css') {
    res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' })
    res.end(ctx.getStyles())
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

  // Serve client JS — bundle app.ts on the fly
  if (pathname === '/_opendoc/app.js') {
    try {
      const result = await Bun.build({
        entrypoints: [join(ctx.clientDir, 'app.ts')],
        target: 'browser',
        minify: false,
      })
      const js = await result.outputs[0]!.text()
      const hotReload = `\n// Hot reload\nconst es = new EventSource('/__reload');\nes.onmessage = () => location.reload();\n`
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' })
      res.end(js + hotReload)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Build error: ${err}`)
    }
    return true
  }

  // Editor route (HTML page)
  if (ctx.editorPath !== null && (pathname === ctx.editorPath || pathname === ctx.editorPath + '/')) {
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

  // Serve assets from page directories
  if (pathname.includes('/assets/')) {
    const filePath = join(ctx.rootDir, pathname.replace(/^\//, ''))
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
