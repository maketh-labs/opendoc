import { join, resolve } from 'path'
import { readdir, unlink, mkdir } from 'fs/promises'
import type { RouteHandler } from './types'

const FAVICON_NAMES = ['favicon.ico', 'favicon.svg', 'favicon.png']
const OG_IMAGE_NAMES = ['og-image.png', 'og-image.jpg', 'og-image.webp']

function getRecognizedNames(type: string): string[] {
  return type === 'favicon' ? FAVICON_NAMES : OG_IMAGE_NAMES
}

function getCanonicalName(type: string, ext: string): string {
  if (type === 'favicon') return `favicon.${ext}`
  return `og-image.${ext}`
}

export const handlePageAsset: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/page-asset') return false

  if (req.method === 'POST') {
    try {
      const rawBody = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
      })
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

      if (!file || (type !== 'favicon' && type !== 'og-image')) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing file or invalid type (favicon | og-image)' }))
        return true
      }

      const pageDir = pagePath === '.' ? ctx.rootDir : join(ctx.rootDir, pagePath)
      const resolvedDir = resolve(pageDir)
      if (!resolvedDir.startsWith(resolve(ctx.rootDir))) {
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
      const rawBody = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
      })
      const { pagePath = '.', type } = JSON.parse(rawBody.toString('utf-8'))

      if (type !== 'favicon' && type !== 'og-image') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid type (favicon | og-image)' }))
        return true
      }

      const pageDir = pagePath === '.' ? ctx.rootDir : join(ctx.rootDir, pagePath)
      const resolvedDir = resolve(pageDir)
      if (!resolvedDir.startsWith(resolve(ctx.rootDir))) {
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
