import { resolve, join, basename, dirname } from 'path'
import { rename, readdir, mkdir, readFile, writeFile, rm, cp, stat, unlink } from 'fs/promises'
import { readJson, resolveInRoot, sendJson, sendText, HttpError, type RouteHandler } from './types'

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

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
  const fullDir = await resolveInRoot(ctx.rootDir, dir)
  if (!fullDir) { sendText(res, 403, 'Forbidden'); return true }

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
    const { order } = await readJson<{ order: unknown }>(req)
    if (!Array.isArray(order) || !order.every(x => typeof x === 'string')) throw new HttpError(400, 'order must be a string array')
    await writeOrderFile(fullDir, order)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  return false
}

export const handleMoveApi: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/move' || req.method !== 'PUT') return false

  const { from, to } = await readJson<{ from?: unknown; to?: unknown }>(req)
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) { sendText(res, 400, 'Missing from or to'); return true }

  const fromPath = await resolveInRoot(ctx.rootDir, from)
  const toPath = await resolveInRoot(ctx.rootDir, to)
  if (!fromPath || !toPath || fromPath === resolve(ctx.rootDir) || toPath === resolve(ctx.rootDir)) {
    sendText(res, 403, 'Forbidden'); return true
  }
  // Case-only renames hit the same entry on case-insensitive filesystems
  if (fromPath.toLowerCase() !== toPath.toLowerCase() && await exists(toPath)) {
    sendText(res, 409, 'Destination already exists'); return true
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

  const { from, to } = await readJson<{ from?: unknown; to?: unknown }>(req)
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) { sendText(res, 400, 'Missing from or to'); return true }

  const fromPath = await resolveInRoot(ctx.rootDir, from)
  const toPath = await resolveInRoot(ctx.rootDir, to)
  if (!fromPath || !toPath || fromPath === resolve(ctx.rootDir) || toPath === resolve(ctx.rootDir)) {
    sendText(res, 403, 'Forbidden'); return true
  }
  // Case-only renames hit the same entry on case-insensitive filesystems
  if (fromPath.toLowerCase() !== toPath.toLowerCase() && await exists(toPath)) {
    sendText(res, 409, 'Destination already exists'); return true
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

  const { path: pagePath } = await readJson<{ path?: unknown }>(req)
  if (typeof pagePath !== 'string' || !pagePath) { sendText(res, 400, 'Missing path'); return true }

  const srcPath = await resolveInRoot(ctx.rootDir, pagePath)
  if (!srcPath || srcPath === resolve(ctx.rootDir)) { sendText(res, 403, 'Forbidden'); return true }

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

  const fullPath = await resolveInRoot(ctx.rootDir, filePath)
  if (!fullPath) { sendText(res, 403, 'Forbidden'); return true }

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
    const { content } = await readJson<{ content?: unknown }>(req)
    if (typeof content !== 'string') throw new HttpError(400, 'content must be a string')
    await Bun.write(fullPath, content)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  if (req.method === 'DELETE') {
    if (fullPath === resolve(ctx.rootDir)) { sendText(res, 403, 'Forbidden'); return true }
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
