import { resolve } from 'path'
import type { IncomingMessage } from 'http'
import type { RouteHandler } from './types'

export const handleFileApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/file') return false

  const filePath = url.searchParams.get('path')
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing path')
    return true
  }

  const fullPath = resolve(ctx.rootDir, filePath)
  if (!fullPath.startsWith(resolve(ctx.rootDir) + '/') && fullPath !== resolve(ctx.rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return true
  }

  if (req.method === 'GET') {
    try {
      const content = await Bun.file(fullPath).text()
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(content)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
    }
    return true
  }

  if (req.method === 'PUT') {
    const body = await new Promise<string>((resolve) => {
      let data = ''
      ;(req as IncomingMessage).on('data', (chunk: Buffer) => { data += chunk.toString() })
      ;(req as IncomingMessage).on('end', () => resolve(data))
    })
    const { content } = JSON.parse(body)
    await Bun.write(fullPath, content)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  return false
}
