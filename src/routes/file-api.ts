import { resolve, join, basename, dirname } from 'path'
import { rename, readdir, mkdir, readFile, writeFile } from 'fs/promises'
import type { RouteHandler } from './types'

async function readOrderFile(dir: string): Promise<string[]> {
  try {
    const raw = await readFile(join(dir, 'order.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed
  } catch {}
  return []
}

async function writeOrderFile(dir: string, order: string[]): Promise<void> {
  await writeFile(join(dir, 'order.json'), JSON.stringify(order, null, 2) + '\n')
}

/** Remove a slug from order.json in a directory, delete the file if it becomes empty. */
async function removeFromOrder(dir: string, slug: string): Promise<void> {
  const order = await readOrderFile(dir)
  const next = order.filter(s => s !== slug)
  if (next.length !== order.length) {
    if (next.length === 0) {
      try { await (await import('fs/promises')).unlink(join(dir, 'order.json')) } catch {}
    } else {
      await writeOrderFile(dir, next)
    }
  }
}

/** Append a slug to order.json in a directory if not already present. */
async function appendToOrder(dir: string, slug: string): Promise<void> {
  const order = await readOrderFile(dir)
  if (!order.includes(slug)) await writeOrderFile(dir, [...order, slug])
}

function isWithinRoot(rootDir: string, fullPath: string): boolean {
  const resolved = resolve(rootDir)
  return fullPath.startsWith(resolved + '/') || fullPath === resolved
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk.toString() })
    req.on('end', () => resolve(data))
  })
}

export const handleOrderApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/order') return false

  const dir = url.searchParams.get('dir') ?? '.'
  const fullDir = resolve(ctx.rootDir, dir)
  if (!isWithinRoot(ctx.rootDir, fullDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return true
  }

  const orderPath = join(fullDir, 'order.json')

  if (req.method === 'GET') {
    try {
      const content = await Bun.file(orderPath).text()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(content)
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    }
    return true
  }

  if (req.method === 'PUT') {
    const body = JSON.parse(await readBody(req))
    const { dir: bodyDir, order } = body
    const targetDir = resolve(ctx.rootDir, bodyDir ?? dir)
    if (!isWithinRoot(ctx.rootDir, targetDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return true
    }
    await Bun.write(join(targetDir, 'order.json'), JSON.stringify(order, null, 2) + '\n')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  return false
}

export const handleMoveApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/move' || req.method !== 'PUT') return false

  const body = JSON.parse(await readBody(req))
  const { from, to } = body as { from: string; to: string }
  if (!from || !to) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing from or to')
    return true
  }

  const fromPath = resolve(ctx.rootDir, from)
  const toPath = resolve(ctx.rootDir, to)
  if (!isWithinRoot(ctx.rootDir, fromPath) || !isWithinRoot(ctx.rootDir, toPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return true
  }

  try {
    // Ensure parent directory of target exists
    await mkdir(dirname(toPath), { recursive: true })
    await rename(fromPath, toPath)

    // Keep order.json consistent: remove from source parent, add to dest parent
    const fromSlug = basename(fromPath)
    const toSlug = basename(toPath)
    const sourceParent = dirname(fromPath)
    const destParent = dirname(toPath)
    await removeFromOrder(sourceParent, fromSlug)
    await appendToOrder(destParent, toSlug)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(String(e))
  }
  return true
}

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
      req.on('data', (chunk: Buffer) => { data += chunk.toString() })
      req.on('end', () => resolve(data))
    })
    const { content } = JSON.parse(body)
    await Bun.write(fullPath, content)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  return false
}
