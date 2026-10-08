// GitHub API — all GitHub operations isolated and independently testable

export type RepoAccess = 'write' | 'read' | 'none'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
}

export async function checkRepoAccess(repo: string, token: string): Promise<RepoAccess> {
  const r = await fetch(`https://api.github.com/repos/${repo}`, { headers: authHeaders(token) })
  if (!r.ok) return 'none'
  const d = await r.json()
  return d.permissions?.push ? 'write' : 'read'
}

export async function getGitHubUsername(token: string): Promise<string> {
  const r = await fetch('https://api.github.com/user', { headers: authHeaders(token) })
  if (!r.ok) throw new Error(`Failed to get GitHub user: ${r.status}`)
  return (await r.json()).login as string
}

export async function fetchUserRepos(token: string): Promise<{ full_name: string }[]> {
  const r = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: authHeaders(token) })
  if (!r.ok) throw new Error(`Failed to fetch repos: ${r.status}`)
  return r.json()
}

function contentsUrl(repo: string, path: string): string {
  return `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
}

export interface GitHubFile {
  /** Decoded file text; empty string when the file does not exist yet */
  content: string
  /** Blob sha of the loaded version; undefined for a new file */
  sha?: string
}

export async function fetchFileFromGitHub(
  repo: string,
  path: string,
  token: string,
  branch = 'main',
): Promise<GitHubFile> {
  const r = await fetch(`${contentsUrl(repo, path)}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  })
  if (r.status === 404) return { content: '' }
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`)
  const data = await r.json()
  // content is base64-encoded with newlines — strip them before decoding
  const b64 = data.content.replace(/\n/g, "")
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return { content: new TextDecoder().decode(bytes), sha: data.sha }
}

export interface CommitResult {
  url?: string
  /** Blob sha of the newly written file — use it as the base for the next commit */
  sha?: string
}

export class ConflictError extends Error {
  constructor(path: string) {
    super(`${path} was changed on GitHub since you opened it. Copy your edits, reload the page, and re-apply them.`)
    this.name = 'ConflictError'
  }
}

function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/**
 * Write a file. `baseSha` must be the sha the edit was based on (undefined for a new file);
 * GitHub rejects the write with 409 if the file changed since, instead of silently overwriting it.
 */
export async function commitFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
  branch: string,
  baseSha: string | undefined,
): Promise<CommitResult> {
  const body: Record<string, unknown> = { message, content: toBase64(content), branch }
  if (baseSha) body.sha = baseSha

  const r = await fetch(contentsUrl(repo, path), {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (r.status === 409 || (r.status === 422 && !baseSha)) throw new ConflictError(path)
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.message || `Failed to commit: ${r.status}`)
  }

  const data = await r.json()
  return { url: data.commit?.html_url, sha: data.content?.sha }
}

async function waitForRef(repo: string, branch: string, token: string, maxAttempts = 15): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: authHeaders(token),
    })
    if (r.ok) return (await r.json()).object.sha as string
    await new Promise(res => setTimeout(res, 1000))
  }
  throw new Error('Fork not ready yet — try again in a few seconds')
}

export async function openPullRequest(
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
  baseBranch: string,
  baseSha: string | undefined,
): Promise<CommitResult> {
  // Step 1: fork (returns the existing fork if there is one; its name may differ from the upstream's)
  const forkRes = await fetch(`https://api.github.com/repos/${repo}/forks`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!forkRes.ok) throw new Error(`Failed to fork repository: ${forkRes.status}`)
  const fork = await forkRes.json() as { full_name: string; owner: { login: string } }
  const forkRepo = fork.full_name

  // Step 2: wait until the fork's base branch exists, then branch from the *upstream* tip
  // (an old fork's base branch may be stale). Forks share objects, so the upstream sha is valid.
  const forkBaseSha = await waitForRef(forkRepo, baseBranch, token)
  const upstreamRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`, {
    headers: authHeaders(token),
  })
  const upstreamSha = upstreamRes.ok ? (await upstreamRes.json()).object.sha as string : forkBaseSha

  const branch = `opendoc-edit-${Date.now()}`
  const createBranch = (sha: string) => fetch(`https://api.github.com/repos/${forkRepo}/git/refs`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
  let branchRes = await createBranch(upstreamSha)
  if (!branchRes.ok && upstreamSha !== forkBaseSha) branchRes = await createBranch(forkBaseSha)
  if (!branchRes.ok) throw new Error(`Failed to create branch: ${branchRes.status}`)

  // Step 3: commit to the fork branch, based on the version the user loaded
  await commitFile(forkRepo, path, content, message, token, branch, baseSha)

  // Step 4: open PR
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: message,
      head: `${fork.owner.login}:${branch}`,
      base: baseBranch,
      body: '_Opened via [OpenDoc](https://opendoc.sh) editor_',
    }),
  })
  if (!prRes.ok) {
    const err = await prRes.json().catch(() => ({}))
    throw new Error(err.message || `Failed to create pull request: ${prRes.status}`)
  }

  return { url: (await prRes.json()).html_url }
}
