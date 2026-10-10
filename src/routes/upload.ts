import { join, relative, sep } from 'path'
import { mkdir } from 'fs/promises'
import { readFormData, resolveInRoot, json, HttpError, type RouteHandler } from './types'

/** Parse a multipart upload: the `file` field plus the page folder from `pagePath` (default: root). */
export async function readPageUpload(req: Request, rootDir: string): Promise<{ form: FormData; file: File; pageDir: string; pageUrl: string }> {
  const form = await readFormData(req)
  const file = form.get('file')
  if (!(file instanceof File)) throw new HttpError(400, 'No file provided')
  const pagePath = form.get('pagePath')
  const pageDir = await resolveInRoot(rootDir, typeof pagePath === 'string' ? pagePath : '.')
  if (!pageDir) throw new HttpError(403, 'Forbidden')
  const rel = relative(rootDir, pageDir).split(sep).filter(Boolean).map(encodeURIComponent).join('/')
  return { form, file, pageDir, pageUrl: rel ? `/${rel}` : '' }
}

export const handleUpload: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/upload' || req.method !== 'POST') return null

  const { file, pageDir, pageUrl } = await readPageUpload(req, ctx.rootDir)
  const assetsDir = join(pageDir, 'assets')
  await mkdir(assetsDir, { recursive: true })

  const safeName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_').replace(/^\.+/, '_')}`
  await Bun.write(join(assetsDir, safeName), file)
  return json({ url: `${pageUrl}/assets/${encodeURIComponent(safeName)}` })
}
