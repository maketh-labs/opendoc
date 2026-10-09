import { simpleGit } from 'simple-git'
import { readJson, json, type RouteHandler } from './types'

/**
 * Push using a GitHub token without writing it to disk or git config: a one-shot
 * credential helper reads it from the child process environment.
 */
async function pushWithToken(cwd: string, token: string): Promise<void> {
  const helper = '!f() { echo username=x-access-token; echo "password=$OPENDOC_GIT_TOKEN"; }; f'
  const proc = Bun.spawn(['git', '-c', 'credential.helper=', '-c', `credential.helper=${helper}`, 'push'], {
    cwd,
    env: { ...process.env, OPENDOC_GIT_TOKEN: token, GIT_TERMINAL_PROMPT: '0' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code !== 0) throw new Error(stderr.trim() || `git push exited with ${code}`)
}

function isGitHubHttpsRemote(remoteUrl: string | undefined): boolean {
  if (!remoteUrl) return false
  try {
    const u = new URL(remoteUrl)
    return u.protocol === 'https:' && u.hostname === 'github.com'
  } catch { return false }
}

export const handleGitStatus: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/git-status' || req.method !== 'GET') return null

  try {
    const git = simpleGit(ctx.rootDir, { config: ['--no-optional-locks'] })
    if (!(await git.checkIsRepo())) return json({ isRepo: false })
    const status = await git.status()
    const remotes = await git.getRemotes(true)
    const log = await git.log({ maxCount: 1 })
    return json({
      isRepo: true,
      branch: status.current,
      remote: remotes.find(r => r.name === 'origin')?.refs?.push || null,
      changes: status.files.length,
      lastCommit: log.latest ? {
        hash: log.latest.hash.slice(0, 7),
        message: log.latest.message,
        date: log.latest.date,
      } : null,
    })
  } catch (e) {
    return json({ isRepo: false, error: String(e) })
  }
}

export const handleCommit: RouteHandler = async (req, url, ctx) => {
  if (url.pathname !== '/_opendoc/commit' || req.method !== 'POST') return null

  const body = await readJson<{ message?: unknown; token?: unknown }>(req)
  const message = typeof body.message === 'string' ? body.message : undefined
  const token = typeof body.token === 'string' && body.token ? body.token : undefined

  const git = simpleGit(ctx.rootDir)
  if (!(await git.checkIsRepo())) return json({ ok: false, error: 'Not a git repository. Run git init first.' }, 400)

  const status = await git.status()
  if (status.files.length === 0) return json({ ok: false, error: 'No changes to commit.' }, 400)

  await git.add('.')
  const commitMessage = message || `docs: update ${new Date().toISOString()}`
  const commitResult = await git.commit(commitMessage)

  let pushed = false
  let pushError = ''
  try {
    const remotes = await git.getRemotes(true)
    const remoteUrl = remotes.find(r => r.name === 'origin')?.refs?.push
    // Only hand the GitHub token to github.com — never to an arbitrary remote
    if (token && isGitHubHttpsRemote(remoteUrl)) {
      await pushWithToken(ctx.rootDir, token)
    } else {
      await git.push()
    }
    pushed = true
  } catch (e) {
    pushError = e instanceof Error ? e.message : String(e)
  }

  return json({
    ok: true,
    committed: true,
    pushed,
    pushError: pushed ? undefined : pushError,
    hash: commitResult.commit,
    message: commitMessage,
    files: status.files.length,
  })
}
