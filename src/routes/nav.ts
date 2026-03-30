import { join } from 'path'
import { buildPublicConfig, ensureConfig } from '../config'
import { walkDir } from '../walker'
import type { RouteHandler } from './types'

export const handleNav: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname === '/_opendoc/config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    res.end(JSON.stringify(buildPublicConfig(ctx.config, ctx.editorPath)))
    return true
  }

  // PATCH /_opendoc/config — update mutable config fields (title, etc.)
  if (url.pathname === '/_opendoc/config' && req.method === 'PATCH') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))

    const { mkdir, writeFile } = await import('fs/promises')
    const configPath = join(ctx.rootDir, '.opendoc', 'config.json')
    await mkdir(join(ctx.rootDir, '.opendoc'), { recursive: true })

    const updated = { ...ctx.config }
    if (typeof body.title === 'string') { updated.title = body.title; ctx.config.title = body.title }

    await writeFile(configPath, JSON.stringify(updated, null, 2) + '\n')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
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
