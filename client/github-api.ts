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

export async function fetchFileFromGitHub(
  repo: string,
  path: string,
  token: string,
  branch = 'main',
): Promise<string> {
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: authHeaders(token),
  })
  if (r.status === 404) return ''
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`)
  const data = await r.json()
  // content is base64-encoded with newlines — strip them before decoding
  const b64 = data.content.replace(/\n/g, "")
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function getFileSha(
  repo: string,
  path: string,
  token: string,
): Promise<string | undefined> {
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: authHeaders(token),
  })
  if (!r.ok) return undefined
  return (await r.json()).sha
}

export interface CommitResult {
  url?: string
}

export async function commitFile(
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
  branch: string,
): Promise<CommitResult> {
  const sha = await getFileSha(repo, path, token)

  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  }
  if (sha) body.sha = sha

  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const err = await r.json()
    throw new Error(err.message || `Failed to commit: ${r.status}`)
  }

  const data = await r.json()
  return { url: data.commit?.html_url }
}

async function waitForFork(forkRepo: string, token: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const r = await fetch(`https://api.github.com/repos/${forkRepo}`, { headers: authHeaders(token) })
    if (r.ok) return
  }
  throw new Error('Fork not ready after 10s — try again shortly')
}

export async function openPullRequest(
  repo: string,
  path: string,
  content: string,
  message: string,
  token: string,
  baseBranch: string,
): Promise<CommitResult> {
  // Step 1: fork
  const username = await getGitHubUsername(token)
  const repoName = repo.split('/')[1]!
  const forkRepo = `${username}/${repoName}`

  const forkRes = await fetch(`https://api.github.com/repos/${repo}/forks`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!forkRes.ok && forkRes.status !== 202) {
    throw new Error(`Failed to fork repository: ${forkRes.status}`)
  }
  await waitForFork(forkRepo, token)

  // Step 2: create branch on fork
  const branch = `opendoc-edit-${Date.now()}`
  const refRes = await fetch(
    `https://api.github.com/repos/${forkRepo}/git/ref/heads/${baseBranch}`,
    { headers: authHeaders(token) },
  )
  if (!refRes.ok) throw new Error(`Failed to get base branch ref: ${refRes.status}`)
  const { object: { sha: branchSha } } = await refRes.json()

  const branchRes = await fetch(`https://api.github.com/repos/${forkRepo}/git/refs`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: branchSha }),
  })
  if (!branchRes.ok) throw new Error(`Failed to create branch: ${branchRes.status}`)

  // Step 3: commit to fork branch
  await commitFile(forkRepo, path, content, message, token, branch)

  // Step 4: open PR
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: message,
      head: `${username}:${branch}`,
      base: baseBranch,
      body: '_Opened via [OpenDoc](https://opendoc.sh) editor_',
    }),
  })
  if (!prRes.ok) {
    const err = await prRes.json()
    throw new Error(err.message || `Failed to create pull request: ${prRes.status}`)
  }

  return { url: (await prRes.json()).html_url }
}
