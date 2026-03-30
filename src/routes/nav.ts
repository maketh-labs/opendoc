import { buildPublicConfig } from '../config'
import { walkDir } from '../walker'
import type { RouteHandler } from './types'

export const handleNav: RouteHandler = async (_req, res, url, ctx) => {
  if (url.pathname === '/_opendoc/config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(buildPublicConfig(ctx.config, ctx.editorPath)))
    return true
  }

  if (url.pathname === '/_opendoc/nav.json') {
    // Always walk fresh — editor calls this right after creating/moving pages
    // and the in-memory navTree may not have been updated by the watcher yet
    const nav = await walkDir(ctx.rootDir)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(nav))
    return true
  }

  return false
}
