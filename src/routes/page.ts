import { relative } from 'path'
import { renderPageData } from '../page-data'
import { resolveInRoot, sendJson, type RouteHandler } from './types'

export const handlePage: RouteHandler = async (_req, res, url, ctx) => {
  // Match /_opendoc/page or /_opendoc/page/... but not /_opendoc/page-asset
  // Also accepts the static-build form: /_opendoc/page.json and /_opendoc/page/<path>.json
  const pathname = url.pathname.replace(/\.json$/, '')
  if (pathname !== '/_opendoc/page' && !pathname.startsWith('/_opendoc/page/')) return false

  const requested = decodeURIComponent(pathname.slice('/_opendoc/page'.length).replace(/^\//, '').replace(/\/$/, ''))
  const pageDir = await resolveInRoot(ctx.rootDir, requested || '.')
  if (!pageDir) { sendJson(res, 404, { error: 'Page not found' }); return true }
  const page = relative(ctx.rootDir, pageDir).split(/[\\/]/).join('/') || '.'

  const result = await renderPageData(ctx.rootDir, page, ctx.getTitleMap(), ctx.getBacklinks())
  if (!result) { sendJson(res, 404, { error: 'Page not found' }); return true }

  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
  res.end(JSON.stringify(result.data))
  return true
}
