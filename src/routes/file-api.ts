import { resolve, join, basename, dirname } from 'path'
import { rename, readdir, mkdir, readFile, writeFile, rm, cp, stat, unlink } from 'fs/promises'
import { readBody, isWithinRoot, type RouteHandler } from './types'

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
      try { await unlink(join(dir, 'order.json')) } catch {}
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

export const handleOrderApi: RouteHandler = async (req, res, url, ctx) => {
  if (!url.pathname.startsWith('/_opendoc/order/')) return false

  const dir = decodeURIComponent(url.pathname.slice('/_opendoc/order/'.length)) || '.'
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
    const { order } = JSON.parse(await readBody(req))
    await Bun.write(join(fullDir, 'order.json'), JSON.stringify(order, null, 2) + '\n')
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

export const handleRenameApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/rename' || req.method !== 'PUT') return false

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
    await rename(fromPath, toPath)
    // Update order.json in parent: replace old slug with new slug
    const parentPath = dirname(fromPath)
    const oldSlug = basename(fromPath)
    const newSlug = basename(toPath)
    const order = await readOrderFile(parentPath)
    const idx = order.indexOf(oldSlug)
    if (idx !== -1) {
      order[idx] = newSlug
      await writeOrderFile(parentPath, order)
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(String(e))
  }
  return true
}

export const handleDuplicateApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/duplicate' || req.method !== 'POST') return false

  const body = JSON.parse(await readBody(req))
  const { path: pagePath } = body as { path: string }
  if (!pagePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing path')
    return true
  }

  const srcPath = resolve(ctx.rootDir, pagePath)
  if (!isWithinRoot(ctx.rootDir, srcPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return true
  }

  try {
    // Find a unique copy name
    const parentPath = dirname(srcPath)
    const slug = basename(srcPath)
    let copySlug = `${slug}-copy`
    let counter = 2
    while (true) {
      try {
        await stat(join(parentPath, copySlug))
        copySlug = `${slug}-copy-${counter++}`
      } catch {
        break
      }
    }

    const destPath = join(parentPath, copySlug)
    await cp(srcPath, destPath, { recursive: true })

    // Add to order.json after the original
    const order = await readOrderFile(parentPath)
    const idx = order.indexOf(slug)
    if (idx !== -1) {
      order.splice(idx + 1, 0, copySlug)
      await writeOrderFile(parentPath, order)
    } else {
      await appendToOrder(parentPath, copySlug)
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, slug: copySlug }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(String(e))
  }
  return true
}

export const handleFileApi: RouteHandler = async (req, res, url, ctx) => {
  if (!url.pathname.startsWith('/_opendoc/file/')) return false

  const filePath = decodeURIComponent(url.pathname.slice('/_opendoc/file/'.length))
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing path')
    return true
  }

  const fullPath = resolve(ctx.rootDir, filePath)
  if (!isWithinRoot(ctx.rootDir, fullPath)) {
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
    const { content } = JSON.parse(await readBody(req))
    await Bun.write(fullPath, content)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  if (req.method === 'DELETE') {
    try {
      const s = await stat(fullPath)
      if (!s.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Path is not a directory')
        return true
      }
      await rm(fullPath, { recursive: true, force: true })
      // Remove from parent's order.json
      const slug = basename(fullPath)
      const parentPath = dirname(fullPath)
      await removeFromOrder(parentPath, slug)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(String(e))
    }
    return true
  }

  return false
}
