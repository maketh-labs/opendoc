import { readFile } from 'fs/promises'
import { join } from 'path'
import { renderFull } from '../renderer'
import { tocToHtml } from '../plugins/toc'
import { backlinksToHtml } from '../render-utils.js'
import { extractTitle } from '../utils.js'
import { resolvePageAssets } from '../walker'
import type { RouteHandler } from './types'

export const handlePage: RouteHandler = async (_req, res, url, ctx) => {
  // Match /_opendoc/page or /_opendoc/page/... but not /_opendoc/page-asset
  if (url.pathname !== '/_opendoc/page' && !url.pathname.startsWith('/_opendoc/page/')) return false
  if (url.pathname.startsWith('/_opendoc/page-')) return false

  const path = decodeURIComponent(url.pathname.slice('/_opendoc/page'.length).replace(/^\//, ''))
  const page = path === '' ? '.' : path

  const indexPath = join(ctx.rootDir, page, 'index.md')
  let markdown: string
  try {
    markdown = await readFile(indexPath, 'utf-8')
  } catch {
    // If the page markdown is missing but assets are requested for root (e.g. site settings),
    // return asset info with empty content rather than 404
    if (page === '.') {
      const assets = await resolvePageAssets(ctx.rootDir, '.')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
      res.end(JSON.stringify({
        html: '', toc: '', title: '', icon: '', backlinks: '',
        faviconUrl: assets.faviconPath,
        ogImageUrl: assets.ogImagePath,
        faviconInherited: assets.faviconInherited,
        ogImageInherited: assets.ogImageInherited,
      }))
      return true
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Page not found' }))
    return true
  }

  const currentPath = page === '.' ? 'index.md' : `${page}/index.md`
  const { html, toc, frontmatter } = await renderFull(markdown, {
    titleMap: ctx.getTitleMap(),
    currentPath,
  })

  const title = extractTitle(markdown, 'OpenDoc')
  const icon = (frontmatter.icon as string) || ''
  const normalized = page === '.' ? '' : page
  const pageBacklinks = ctx.getBacklinks()[normalized] || []
  const assets = await resolvePageAssets(ctx.rootDir, page)

  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
  res.end(JSON.stringify({
    html,
    toc: tocToHtml(toc),
    title,
    icon,
    backlinks: backlinksToHtml(pageBacklinks),
    faviconUrl: assets.faviconPath,
    ogImageUrl: assets.ogImagePath,
    faviconInherited: assets.faviconInherited,
    ogImageInherited: assets.ogImageInherited,
  }))
  return true
}
