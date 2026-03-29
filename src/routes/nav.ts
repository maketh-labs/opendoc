import type { RouteHandler } from './types'

export const handleNav: RouteHandler = async (_req, res, url, ctx) => {
  if (url.pathname === '/_opendoc/config.json') {
    const { clientSecret: _s, ...publicGithub } = ctx.config.github || {}
    const publicConfig = {
      title: ctx.config.title,
      editorPath: ctx.editorPath ?? '/editor',
      github: ctx.config.github ? publicGithub : undefined,
      theme: ctx.config.theme,
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(publicConfig))
    return true
  }

  if (url.pathname === '/_opendoc/nav.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(ctx.getNavTree()))
    return true
  }

  return false
}
