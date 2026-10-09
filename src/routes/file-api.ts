import { resolve, join, basename, dirname } from 'path'
import { rename, mkdir, cp, stat } from 'fs/promises'
import { readJson, resolveInRoot, isWithinRoot, json, fail, HttpError, type RouteHandler } from './types'
import { readOrderFile, writeOrderFile, removeFromOrder, addToOrder } from '../order'
import { moveToTrash, restoreFromTrash } from '../trash'

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}

/** Resolve and validate a { from, to } body for move/rename */
async function resolveFromTo(req: Request, rootDir: string): Promise<{ fromPath: string; toPath: string }> {
  const { from, to } = await readJson<{ from?: unknown; to?: unknown }>(req)
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) throw new HttpError(400, 'Missing from or to')

  const root = resolve(rootDir)
  const fromPath = await resolveInRoot(rootDir, from)
  const toPath = await resolveInRoot(rootDir, to)
  if (!fromPath || !toPath || fromPath === root || toPath === root) throw new HttpError(403, 'Forbidden')
  if (!(await exists(fromPath))) throw new HttpError(404, `Page not found: ${from}`)
  // Case-only renames hit the same entry on case-insensitive filesystems
  if (fromPath.toLowerCase() !== toPath.toLowerCase() && await exists(toPath)) {
    throw new HttpError(409, `A page already exists at ${to}`)
  }
  if (toPath !== fromPath && isWithinRoot(fromPath, toPath)) throw new HttpError(400, 'Cannot move a page inside itself')
  return { fromPath, toPath }
}

export const handleOrderApi: RouteHandler = async (req, url, ctx) => {
  if (!url.pathname.startsWith('/_opendoc/order/')) return null

  const dir = decodeURIComponent(url.pathname.slice('/_opendoc/order/'.length)) || '.'
  const fullDir = await resolveInRoot(ctx.rootDir, dir)
  if (!fullDir) return fail(403, 'Forbidden')

  if (req.method === 'GET') return json(await readOrderFile(fullDir))

  if (req.method === 'PUT') {
    const { order } = await readJson<{ order: unknown }>(req)
    if (!Array.isArray(order) || !order.every(x => typeof x === 'string')) throw new HttpError(400, 'order must be a string array')
    await writeOrderFile(fullDir, order)
    return json({ ok: true })
  }
  return null
}

export const handleMoveApi: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/move' || req.method !== 'PUT') return null
  const { fromPath, toPath } = await resolveFromTo(req, ctx.rootDir)

  await mkdir(dirname(toPath), { recursive: true })
  await rename(fromPath, toPath)
  // Keep order.json consistent: remove from source parent, add to destination parent
  await removeFromOrder(dirname(fromPath), basename(fromPath))
  await addToOrder(dirname(toPath), basename(toPath))
  return json({ ok: true })
}

export const handleRenameApi: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/rename' || req.method !== 'PUT') return null
  const { fromPath, toPath } = await resolveFromTo(req, ctx.rootDir)

  await rename(fromPath, toPath)
  // Keep the page's position: replace the old slug in the parent's order.json
  const parent = dirname(fromPath)
  const order = await readOrderFile(parent)
  const idx = order.indexOf(basename(fromPath))
  if (idx !== -1) {
    order[idx] = basename(toPath)
    await writeOrderFile(parent, order)
  }
  return json({ ok: true })
}

export const handleDuplicateApi: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/duplicate' || req.method !== 'POST') return null

  const { path: pagePath } = await readJson<{ path?: unknown }>(req)
  if (typeof pagePath !== 'string' || !pagePath) throw new HttpError(400, 'Missing path')
  const srcPath = await resolveInRoot(ctx.rootDir, pagePath)
  if (!srcPath || srcPath === resolve(ctx.rootDir)) return fail(403, 'Forbidden')
  if (!(await exists(srcPath))) return fail(404, `Page not found: ${pagePath}`)

  const parent = dirname(srcPath)
  const slug = basename(srcPath)
  let copySlug = `${slug}-copy`
  for (let n = 2; await exists(join(parent, copySlug)); n++) copySlug = `${slug}-copy-${n}`

  await cp(srcPath, join(parent, copySlug), { recursive: true })
  await addToOrder(parent, copySlug, slug)
  return json({ ok: true, slug: copySlug })
}

export const handleRestoreApi: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/restore' || req.method !== 'POST') return null
  const { trashId } = await readJson<{ trashId?: unknown }>(req)
  if (typeof trashId !== 'string') throw new HttpError(400, 'Missing trashId')
  return json({ ok: true, path: await restoreFromTrash(ctx.rootDir, trashId) })
}

export const handleFileApi: RouteHandler = async (req, url, ctx) => {
  if (!url.pathname.startsWith('/_opendoc/file/')) return null

  const filePath = decodeURIComponent(url.pathname.slice('/_opendoc/file/'.length))
  if (!filePath) return fail(400, 'Missing path')
  const fullPath = await resolveInRoot(ctx.rootDir, filePath)
  if (!fullPath) return fail(403, 'Forbidden')

  if (req.method === 'GET') {
    const file = Bun.file(fullPath)
    if (!(await file.exists())) return fail(404, 'Not found')
    return new Response(await file.text(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (req.method === 'PUT') {
    const { content } = await readJson<{ content?: unknown }>(req)
    if (typeof content !== 'string') throw new HttpError(400, 'content must be a string')
    await Bun.write(fullPath, content)
    return json({ ok: true })
  }

  if (req.method === 'DELETE') {
    if (fullPath === resolve(ctx.rootDir)) return fail(403, 'Forbidden')
    const s = await stat(fullPath).catch(() => null)
    if (!s) return fail(404, 'Not found')
    if (!s.isDirectory()) return fail(400, 'Path is not a directory')
    // Soft delete: recoverable via POST /_opendoc/restore
    const trashId = await moveToTrash(ctx.rootDir, fullPath)
    return json({ ok: true, trashId })
  }

  return null
}
