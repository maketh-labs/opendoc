import { join } from 'path'
import { writeFile } from 'fs/promises'
import { buildPublicConfig } from '../config'
import { readJson, json, type RouteHandler } from './types'

const NO_CACHE = { 'Cache-Control': 'no-cache' }

export const handleNav: RouteHandler = async (req, url, ctx) => {
  if (url.pathname === '/_opendoc/config.json') {
    return json(buildPublicConfig(ctx.config, ctx.editorPath), 200, NO_CACHE)
  }

  // PATCH /_opendoc/config — update mutable config fields (title, faviconConfig)
  if (url.pathname === '/_opendoc/config' && req.method === 'PATCH') {
    const body = await readJson<{ title?: unknown; faviconConfig?: unknown }>(req)
    if (typeof body.title === 'string') ctx.config.title = body.title
    if (body.faviconConfig && typeof body.faviconConfig === 'object' && !Array.isArray(body.faviconConfig)) {
      ctx.config.faviconConfig = body.faviconConfig as typeof ctx.config.faviconConfig
    }
    await writeFile(join(ctx.rootDir, 'opendoc.json'), JSON.stringify(ctx.config, null, 2) + '\n')
    return json({ ok: true })
  }

  // Served from the in-memory index; the server refreshes it after every editing request
  if (url.pathname === '/_opendoc/nav.json') {
    return json(ctx.index.getNavTree(), 200, NO_CACHE)
  }

  if (url.pathname === '/_opendoc/search-index.json') {
    return json(ctx.index.getSearchIndex(), 200, NO_CACHE)
  }

  return null
}
