import { join, relative } from 'path'
import { mkdir } from 'fs/promises'
import { readFormData, resolveInRoot, sendJson, type RouteHandler } from './types'

export const handleUpload: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/upload' || req.method !== 'POST') return false

  const form = await readFormData(req)
  const file = form.get('file')
  const pagePath = form.get('pagePath')
  if (!(file instanceof File)) { sendJson(res, 400, { error: 'No file provided' }); return true }

  const pageDir = await resolveInRoot(ctx.rootDir, typeof pagePath === 'string' ? pagePath : '.')
  if (!pageDir) { sendJson(res, 403, { error: 'Forbidden' }); return true }

  const assetsDir = join(pageDir, 'assets')
  await mkdir(assetsDir, { recursive: true })

  const safeName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_').replace(/^\.+/, '_')}`
  await Bun.write(join(assetsDir, safeName), await file.arrayBuffer())

  const rel = relative(ctx.rootDir, assetsDir).split(/[\\/]/).filter(Boolean).map(encodeURIComponent).join('/')
  sendJson(res, 200, { url: `/${rel}/${encodeURIComponent(safeName)}` })
  return true
}
