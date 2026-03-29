import { buildPublicConfig } from '../config'
import type { RouteHandler } from './types'

export const handleNav: RouteHandler = async (_req, res, url, ctx) => {
  if (url.pathname === '/_opendoc/config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(buildPublicConfig(ctx.config, ctx.editorPath)))
    return true
  }

  if (url.pathname === '/_opendoc/nav.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(ctx.getNavTree()))
    return true
  }

  return false
}
