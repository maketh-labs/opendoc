import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import type { IncomingMessage } from 'http'
import simpleGit from 'simple-git'
import type { RouteHandler } from './types'

export const handleGitStatus: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/git-status' || req.method !== 'GET') return false

  try {
    const git = simpleGit(ctx.rootDir)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ isRepo: false }))
      return true
    }
    const status = await git.status()
    const remotes = await git.getRemotes(true)
    const log = await git.log({ maxCount: 1 })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      isRepo: true,
      branch: status.current,
      remote: remotes.find(r => r.name === 'origin')?.refs?.push || null,
      changes: status.files.length,
      lastCommit: log.latest ? {
        hash: log.latest.hash.slice(0, 7),
        message: log.latest.message,
        date: log.latest.date,
      } : null,
    }))
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ isRepo: false, error: String(e) }))
  }
  return true
}

export const handleCommit: RouteHandler = async (req, res, url, ctx) => {
  if (url.pathname !== '/_opendoc/commit' || req.method !== 'POST') return false

  const body = await new Promise<string>((resolve) => {
    let data = ''
    ;(req as IncomingMessage).on('data', (chunk: Buffer) => { data += chunk.toString() })
    ;(req as IncomingMessage).on('end', () => resolve(data))
  })
  const { message, token } = JSON.parse(body) as { message?: string; token?: string }

  try {
    const git = simpleGit(ctx.rootDir)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Not a git repository. Run git init first.' }))
      return true
    }

    const status = await git.status()
    if (status.files.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'No changes to commit.' }))
      return true
    }

    await git.add('.')
    const commitMessage = message || `docs: update ${new Date().toISOString()}`
    const commitResult = await git.commit(commitMessage)

    let pushed = false
    let pushError = ''

    try {
      if (token) {
        const remotes = await git.getRemotes(true)
        const origin = remotes.find(r => r.name === 'origin')
        const remoteUrl = origin?.refs?.push

        if (remoteUrl?.startsWith('https://')) {
          const credContent = `url=${remoteUrl.replace('https://', `https://x-token:${token}@`)}\n`
          const tmpCred = join(tmpdir(), `.opendoc-creds-${Date.now()}`)
          await writeFile(tmpCred, credContent, { mode: 0o600 })
          try {
            await git.addConfig('credential.helper', `store --file=${tmpCred}`, false, 'local')
            await git.push()
            pushed = true
          } finally {
            await unlink(tmpCred).catch(() => {})
            await git.raw(['config', '--local', '--unset', 'credential.helper']).catch(() => {})
          }
        } else {
          await git.push()
          pushed = true
        }
      } else {
        await git.push()
        pushed = true
      }
    } catch (e) {
      pushError = e instanceof Error ? e.message : String(e)
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      committed: true,
      pushed,
      pushError: pushed ? undefined : pushError,
      hash: commitResult.commit,
      message: commitMessage,
      files: status.files.length,
    }))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  }
  return true
}
