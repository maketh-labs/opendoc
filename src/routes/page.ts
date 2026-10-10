import { relative, sep } from 'path'
import { renderPageData } from '../page-data'
import { resolveInRoot, json, fail, type RouteHandler } from './types'

export const handlePage: RouteHandler = async (_req, url, ctx) => {
  // /_opendoc/page[/<path>], also the static-build form /_opendoc/page.json and /_opendoc/page/<path>.json
  const pathname = url.pathname.replace(/\.json$/, '')
  if (pathname !== '/_opendoc/page' && !pathname.startsWith('/_opendoc/page/')) return null

  const requested = decodeURIComponent(pathname.slice('/_opendoc/page'.length).replace(/^\/|\/$/g, ''))
  const pageDir = await resolveInRoot(ctx.rootDir, requested || '.')
  if (!pageDir) return fail(404, 'Page not found')
  const page = relative(ctx.rootDir, pageDir).split(sep).join('/') || '.'

  const result = await renderPageData(ctx.rootDir, page, ctx.index.getTitleMap(), ctx.index.getBacklinks())
  if (!result) return fail(404, 'Page not found')
  return json(result.data, 200, { 'Cache-Control': 'no-cache' })
}
