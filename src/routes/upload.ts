import { join } from 'path'
import type { IncomingMessage } from 'http'
import type { RouteHandler } from './types'

export const handleUpload: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/upload' || req.method !== 'POST') return false

  try {
    const rawBody = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = []
      ;(req as IncomingMessage).on('data', (c: Buffer) => chunks.push(c))
      ;(req as IncomingMessage).on('end', () => resolve(Buffer.concat(chunks)))
    })
    const bunReq = new Request('http://localhost/_opendoc/upload', {
      method: 'POST',
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      body: rawBody.buffer as ArrayBuffer,
    })
    const form = await bunReq.formData()
    const file = form.get('file') as File | null
    const pagePath = (form.get('pagePath') as string | null) ?? '.'

    if (!file) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('No file provided')
      return true
    }

    const { mkdir } = await import('fs/promises')
    const assetsDir = join(ctx.rootDir, pagePath === '.' ? '' : pagePath, 'assets')
    await mkdir(assetsDir, { recursive: true })

    const safeName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_')}`
    const filePath = join(assetsDir, safeName)
    await Bun.write(filePath, await file.arrayBuffer())

    const urlPath = pagePath === '.' ? `/assets/${safeName}` : `/${pagePath}/assets/${safeName}`
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: urlPath }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: String(e) }))
  }
  return true
}
